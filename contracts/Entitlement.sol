// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/// @title EntitlementRegistryDID
/// @notice Registro on-chain de habilitaciones (grants) indexadas por DID y rol.
///         Pensado para que las propuestas (Governor+Timelock) creen/actualicen/revoquen
///         y un backend aplique en OpenBao (admin/ssh/etc) escuchando eventos.
contract EntitlementRegistryDID {
    error NotTimelock();
    error InvalidTimeWindow();

    /// @dev Dirección del Timelock autorizada a mutar el registro.
    address public timelock;

    /// @dev Roles sugeridos (podés agregar más a gusto desde el front/DAO).
    bytes32 public constant ROLE_ADMIN = keccak256("ROLE_ADMIN");
    bytes32 public constant ROLE_SSH   = keccak256("ROLE_SSH");

    /// @dev Estructura del grant.
    /// did:    DID textual (ej: "did:key:...", "did:ethr:...", "did:web:...").
    /// didHash: keccak256(did) para indexación compacta.
    /// role:   rol concedido (bytes32).
    /// start:  unix seconds desde cuando es válido.
    /// expiry: unix seconds hasta cuando vence (0 = sin vencimiento).
    /// active: flag lógico (además del rango temporal).
    /// revoked: si fue revocado explícitamente.
    /// revokedAt/revokedBy: auditoría de revocación.
    /// descriptionHash: hash de la descripción de la propuesta (Governor) para trazabilidad.
    struct Grant {
        string  did;
        bytes32 didHash;
        bytes32 role;
        uint64  start;
        uint64  expiry;           // 0 = sin fecha de expiración
        bool    active;
        bool    revoked;
        uint64  revokedAt;
        address revokedBy;
        bytes32 descriptionHash;
    }

    /// @dev Clave principal -> grantId = keccak256(didHash, role)
    mapping(bytes32 => Grant) private _grants;

    /// @dev Índice secundario: didHash -> role -> grantId
    mapping(bytes32 => mapping(bytes32 => bytes32)) public grantIdByDidRole;

    event GrantUpserted(
        bytes32 indexed grantId,
        bytes32 indexed didHash,
        bytes32 indexed role,
        string  did,
        uint64  start,
        uint64  expiry,
        bool    active,
        bytes32 descriptionHash
    );

    event GrantRevoked(
        bytes32 indexed grantId,
        bytes32 indexed didHash,
        bytes32 indexed role,
        string  did,
        uint64  revokedAt,
        address revokedBy,
        string  reason
    );

    event TimelockUpdated(address indexed oldTimelock, address indexed newTimelock);

    modifier onlyTimelock() {
        if (msg.sender != timelock) revert NotTimelock();
        _;
    }

    constructor(address _timelock) {
        require(_timelock != address(0), "timelock=0");
        timelock = _timelock;
    }

    /// @notice Permite migrar el timelock (llamado por el timelock actual).
    function updateTimelock(address newTimelock) external onlyTimelock {
        require(newTimelock != address(0), "newTimelock=0");
        emit TimelockUpdated(timelock, newTimelock);
        timelock = newTimelock;
    }

    /// @notice Calcula el ID del grant: keccak256( keccak256(did), role ).
    function computeGrantIdFromDid(string memory did, bytes32 role) public pure returns (bytes32) {
        bytes32 didHash = keccak256(bytes(did));
        return keccak256(abi.encodePacked(didHash, role));
    }

    /// @notice Retorna el grantId a partir de didHash+role.
    function computeGrantId(bytes32 didHash, bytes32 role) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(didHash, role));
    }

    /// @notice Crea o actualiza un grant (DID+rol). Solo el Timelock.
    /// @param did DID textual (p.ej. "did:key:z6Mk...", "did:web:openvino.org:...").
    /// @param role rol (bytes32).
    /// @param start unix seconds inicio (0 => ahora).
    /// @param expiry unix seconds vencimiento (0 => sin vencimiento).
    /// @param active flag de activación adicional al rango temporal.
    /// @param descriptionHash hash de la descripción de la propuesta (Governor).
    function upsertGrantByDID(
        string calldata did,
        bytes32 role,
        uint64 start,
        uint64 expiry,
        bool active,
        bytes32 descriptionHash
    ) external onlyTimelock returns (bytes32 grantId) {
        bytes32 didHash = keccak256(bytes(did));
        if (start == 0) start = uint64(block.timestamp);
        if (expiry != 0 && expiry < start) revert InvalidTimeWindow();

        grantId = computeGrantId(didHash, role);
        Grant storage g = _grants[grantId];

        g.did             = did;
        g.didHash         = didHash;
        g.role            = role;
        g.start           = start;
        g.expiry          = expiry;
        g.active          = active;
        g.revoked         = false;
        g.revokedAt       = 0;
        g.revokedBy       = address(0);
        g.descriptionHash = descriptionHash;

        grantIdByDidRole[didHash][role] = grantId;

        emit GrantUpserted(grantId, didHash, role, did, start, expiry, active, descriptionHash);
    }

    /// @notice Revoca un grant (queda inactivo, sin borrar historial).
    function revokeGrantByDID(string calldata did, bytes32 role, string calldata reason) external onlyTimelock {
        bytes32 didHash = keccak256(bytes(did));
        bytes32 grantId = computeGrantId(didHash, role);
        Grant storage g = _grants[grantId];

        // Si no existía, igualmente deja traza de revocación sobre did/rol.
        if (bytes(g.did).length == 0) {
            g.did     = did;
            g.didHash = didHash;
            g.role    = role;
        }

        g.active    = false;
        g.revoked   = true;
        g.revokedAt = uint64(block.timestamp);
        g.revokedBy = msg.sender;

        emit GrantRevoked(grantId, didHash, role, g.did, g.revokedAt, g.revokedBy, reason);
    }

    /// ======== GETTERS ========

    function getGrant(bytes32 grantId) external view returns (Grant memory) {
        return _grants[grantId];
    }

    function getGrantByDID(string calldata did, bytes32 role) external view returns (Grant memory) {
        bytes32 didHash = keccak256(bytes(did));
        bytes32 id = grantIdByDidRole[didHash][role];
        return _grants[id];
    }

    /// @notice ¿Está activo ahora? (considera flags + ventana temporal)
    function isCurrentlyActiveByDID(string calldata did, bytes32 role) external view returns (bool) {
        bytes32 didHash = keccak256(bytes(did));
        bytes32 id = computeGrantId(didHash, role);
        Grant storage g = _grants[id];
        if (!g.active || g.revoked) return false;
        if (g.start > block.timestamp) return false;
        if (g.expiry != 0 && block.timestamp > g.expiry) return false;
        return true;
    }
}
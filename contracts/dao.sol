// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Nonces.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";

contract OpenvinoDao is
    ERC20,
    ERC20Burnable,
    ERC20Pausable,
    ERC20Permit,
    ERC20Votes,
    AccessControl
{
    bytes32 public constant PAUSER_ROLE   = keccak256("PAUSER_ROLE");
    bytes32 public constant REBASER_ROLE  = keccak256("REBASER_ROLE");

    uint256 public constant INITIAL_FRAGMENTS_SUPPLY = 10_000_000 * 10 ** 18;
    uint256 private constant TOTAL_GONS =
        type(uint128).max - (type(uint128).max % INITIAL_FRAGMENTS_SUPPLY);

    uint256 private _gonsPerFragment;
    mapping(address => uint256) private _gonBalances;

    event Rebase(uint256 oldSupply, uint256 newSupply);

    constructor(
        address recipient,
        address defaultAdmin,
        address pauser
    )
        ERC20("OpenvinoDao", "OVI")
        ERC20Permit("OpenvinoDao")
    {
        // Asignar roles
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(PAUSER_ROLE, pauser);
        _grantRole(REBASER_ROLE, defaultAdmin);

        // Inicializar rebase y asignar todo el supply inicial al recipient
        _gonsPerFragment = TOTAL_GONS / INITIAL_FRAGMENTS_SUPPLY;
        _gonBalances[recipient] = INITIAL_FRAGMENTS_SUPPLY * _gonsPerFragment;
        emit Transfer(address(0), recipient, INITIAL_FRAGMENTS_SUPPLY);
    }

    /// @notice Duplica el suministro total (split ×2)
    function split()
        external
        onlyRole(REBASER_ROLE)
    {
        uint256 oldSupply = totalSupply();
        uint256 newSupply = oldSupply * 2;
        require(newSupply > oldSupply, "split overflow");
        _gonsPerFragment = TOTAL_GONS / newSupply;
        emit Rebase(oldSupply, newSupply);
    }

    /// @notice Pausar transferencias
    function pause()
        external
        onlyRole(PAUSER_ROLE)
    {
        _pause();
    }

    /// @notice Reanudar transferencias
    function unpause()
        external
        onlyRole(PAUSER_ROLE)
    {
        _unpause();
    }

    /// @dev Suministro público calculado a partir de GONS
    function totalSupply()
        public
        view
        override(ERC20)
        returns (uint256)
    {
        return TOTAL_GONS / _gonsPerFragment;
    }

    /// @dev Balance público calculado a partir de GONS
    function balanceOf(address account)
        public
        view
        override(ERC20)
        returns (uint256)
    {
        return _gonBalances[account] / _gonsPerFragment;
    }

    /**
     * @dev Hook unificado para transferencias, mints y burns.
     *      Reemplaza el uso de _balances con _gonBalances y mantiene gobernanza.
     */
    function _update(
        address from,
        address to,
        uint256 amount
    )
        internal
        virtual
        override(ERC20, ERC20Pausable, ERC20Votes)
    {
        // 1) Pausable
        require(!paused(), "Pausable: paused");

        // 2) Cálculo en GONS
        uint256 gonValue = amount * _gonsPerFragment;

        // 3a) Débito en GONS (transfer o burn)
        if (from != address(0)) {
            uint256 fg = _gonBalances[from];
            require(fg >= gonValue, "Rebase: insufficient");
            unchecked { _gonBalances[from] = fg - gonValue; }
        }

        // 3b) Crédito en GONS (transfer o mint)
        if (to != address(0)) {
            _gonBalances[to] += gonValue;
        }

        // 4) Emitir evento Transfer estándar
        emit Transfer(from, to, amount);

        // 5) Actualizar checkpoints de voto
        _transferVotingUnits(from, to, amount);
    }

    /// @dev Para ERC20Permit → nonces
    function nonces(address owner)
        public
        view
        override(ERC20Permit, Nonces)
        returns (uint256)
    {
        return super.nonces(owner);
    }
}

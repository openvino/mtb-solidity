# 🧪 OpenvinoDAO Deployment & Proposal Suite

Este repositorio contiene scripts y contratos inteligentes para desplegar el ecosistema de OpenvinoDAO, incluyendo el token OVI, contratos de gobernanza (Governor, Timelock), tokens MTB y la generación de propuestas on-chain.

---

## 📦 Requisitos

- Node.js
- Hardhat
- Cuenta en Base / Base Sepolia
- `.env` con `PRIVATE_KEY` configurado

---

## 🧱 1. Deploy de Tokens MTB

1. Configura el archivo `.env` con tu clave privada.
2. Ajusta los nombres, símbolos y supply de los tokens en [`./utils/tokens.js`](./utils/tokens.js).
3. Ejecuta:

```bash
npm install
npx hardhat compile
npx hardhat run scripts/deploy.js --network base
```

4. Verificación manual (si falla la automática):

```bash
npx hardhat verify --network base --contract contracts/mtb.sol:MTB \
  0x... "MikeTangoBravo25" "MTB25" 1024000000000000000000 1024000000000000000000
```

---

## 🧑‍⚖️ 2. Deploy del Sistema de Gobernanza DAO

Este script despliega:

- `MyTimelock`
- `OpenvinoDao` (token OVI)
- `MyGovernor`
- Y delega el poder de voto al deployer.

```bash
npx hardhat run scripts/deploy_dao.js --network base
```

Esto guardará las direcciones en `deployments/dao.json`.

---

## 💵 3. Deploy de Crowdsale (opcional)

```bash
# Asegúrate de configurar el token y el destinatario dentro del script.
npx hardhat run scripts/deployCrowdsale.js --network base
```

---

## 📤 4. Scripts de Propuestas

Todos requieren que los contratos estén desplegados y las direcciones almacenadas en `deployments/dao.json`.

### 🔁 Transferencia de tokens (OVI) desde el Treasury

```bash
npx hardhat run scripts/proposeTransfer.js --network base
```

### 🍷 Propuesta de Split de tokens DAO (llama a `split()`)

```bash
npx hardhat run scripts/proposeSplit.js --network base
```

### 🧑‍🎨 Mint de tokens OVI (propuesta de acuñación)

```bash
npx hardhat run scripts/proposeMint.js --network base
```

### 🗳️ Emitir un voto

```bash
npx hardhat run scripts/voteProposal.js --network base
```

> ⚠️ Verifica que la propuesta esté activa antes de votar.

---

## 📁 Archivos Importantes

| Archivo                      | Descripción                |
| ---------------------------- | -------------------------- |
| `scripts/deploy.js`          | Deploy de tokens MTB       |
| `scripts/deployDao.js`       | Deploy completo de la DAO  |
| `scripts/proposeTransfer.js` | Propuesta de transferencia |
| `scripts/proposeSplit.js`    | Propuesta de split         |
| `scripts/proposeMint.js`     | Propuesta de mint          |
| `scripts/voteProposal.js`    | Emitir voto                |

---

## ✅ Resultado Esperado

Con estos scripts puedes:

- Desplegar tokens y contratos de gobernanza.
- Crear propuestas on-chain.
- Votar y ejecutar propuestas.
- Realizar splits de tesorería y gobernar el ecosistema.

---

## 🧠 Tips

- Usa BaseScan para verificar contratos.
- Asegúrate que el `Timelock` tenga saldo de OVI/ETH para ejecutar acciones.
- Las propuestas deben pasar por las fases: `Pending → Active → Succeeded → Queued → Executed`.

---

## © OpenvinoDAO · 2025

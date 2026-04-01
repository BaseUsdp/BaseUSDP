# BaseUSDP — Pagos Privados en Base

## Descripcion
BaseUSDP es un protocolo de pagos de privacidad de codigo abierto construido sobre la red Base. Permite transferencias privadas de USDC utilizando pruebas de conocimiento cero (ZK proofs), asegurando que los detalles de la transaccion permanezcan confidenciales.

## Caracteristicas Principales
- **Transferencias Privadas:** Envie USDC sin revelar la conexion entre remitente y destinatario
- **Pruebas de Conocimiento Cero:** Las pruebas se generan en el navegador, sin datos privados en el servidor
- **Bajo Costo:** Las transacciones en Base cuestan menos de $0.01
- **Nombres de Usuario:** Envie pagos a nombres legibles en lugar de direcciones de billetera
- **Pagos x402:** Protocolo de pago para comerciantes con soporte de QR

## Inicio Rapido
```bash
git clone https://github.com/BaseUsdp/BaseUSDP.git
cd BaseUSDP
npm install
cp .env.example .env.local
npm run dev
```

## Documentacion
Consulte el directorio [docs/](./docs/) para guias completas, referencia de API y documentacion conceptual.

## Licencia
MIT — consulte [LICENSE](../LICENSE) para mas detalles.

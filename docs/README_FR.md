# BaseUSDP — Paiements Prives sur Base

## Description
BaseUSDP est un protocole de paiement de confidentialite open-source construit sur le reseau Base. Il permet des transferts prives de USDC en utilisant des preuves a connaissance nulle (ZK proofs), garantissant que les details des transactions restent confidentiels.

## Fonctionnalites Principales
- **Transferts Prives:** Envoyez des USDC sans reveler le lien entre expediteur et destinataire
- **Preuves a Connaissance Nulle:** Les preuves sont generees dans le navigateur, aucune donnee privee sur le serveur
- **Faible Cout:** Les transactions sur Base coutent moins de 0,01 $
- **Noms d'Utilisateur:** Envoyez des paiements a des noms lisibles au lieu d'adresses de portefeuille
- **Paiements x402:** Protocole de paiement pour les commercants avec support QR

## Demarrage Rapide
```bash
git clone https://github.com/BaseUsdp/BaseUSDP.git
cd BaseUSDP
npm install
cp .env.example .env.local
npm run dev
```

## Documentation
Consultez le repertoire [docs/](./docs/) pour des guides complets, la reference API et la documentation conceptuelle.

## Licence
MIT — voir [LICENSE](../LICENSE) pour plus de details.

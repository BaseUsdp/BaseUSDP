# BaseUSDP — Base 网络上的隐私支付

## 描述
BaseUSDP 是一个建立在 Base 网络上的开源隐私支付协议。它使用零知识证明 (ZK proofs) 实现私密的 USDC 转账,确保交易细节保持机密。

## 主要特点
- **私密转账:** 发送 USDC 而不暴露发送者和接收者之间的关联
- **零知识证明:** 证明在浏览器中生成,没有私密数据传输到服务器
- **低成本:** Base 上的交易费用不到 $0.01
- **用户名:** 使用可读名称发送付款,而非钱包地址
- **x402 支付:** 支持 QR 码的商户支付协议

## 快速开始
```bash
git clone https://github.com/BaseUsdp/BaseUSDP.git
cd BaseUSDP
npm install
cp .env.example .env.local
npm run dev
```

## 文档
请查看 [docs/](./docs/) 目录获取完整的指南、API 参考和概念文档。

## 许可证
MIT — 详见 [LICENSE](../LICENSE)。

# Privacy Sets (Anonymity Sets)

## What is a Privacy Set?
A privacy set (or anonymity set) is the group of users whose transactions are indistinguishable from each other. The larger the set, the stronger the privacy guarantee.

## How Privacy Sets Work in BaseUSDP
When you deposit 10 USDC (Tier 2), you join the pool of all Tier 2 depositors. When you later transfer, the ZK proof demonstrates you are one of those depositors without revealing which one. If there are 500 Tier 2 deposits, an observer has a 1-in-500 chance of guessing correctly.

## Measuring Privacy Strength
| Set Size | Privacy Level | Bits of Privacy |
|----------|--------------|-----------------|
| 10 | Basic | ~3.3 bits |
| 100 | Good | ~6.6 bits |
| 1,000 | Strong | ~10 bits |
| 10,000 | Very Strong | ~13.3 bits |

## Growing the Set
Privacy sets grow over time as more users make deposits. The BaseUSDP dashboard shows the current anonymity set size for each tier. Larger tiers may have smaller sets initially but grow as adoption increases.

## Best Practices
- Check the anonymity set size before depositing
- Prefer tiers with larger anonymity sets
- Wait for the set to grow before making transfers for maximum privacy
- Avoid being the first depositor in a new tier

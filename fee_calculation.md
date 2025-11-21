# Fee Calculation for Swap

## Given:
- Input: 0.0014598 cbBTC
- Output (user receives): 0.00145976 xBTC  
- swap_fee = 57500 (in Giga format, represents 0.005%)
- beneficiary_fee = 300000000 (in Giga format, represents 30%)

## Fee Format:
Fees are stored in "Giga" format (10^9 scaling):
- swap_fee = 57500 → 57500 / 10^9 = 0.0000575 = 0.00575% (user said 0.005%, close)
- beneficiary_fee = 300000000 → 300000000 / 10^9 = 0.3 = 30%

## Calculation Steps (from swap_v2.rs):

### Step 1: User receives amount_out
User receives: **0.00145976 xBTC** (this is `amount_out` after swap fee is deducted)

### Step 2: Calculate balance_out_without_fee
From code line 58:
```rust
amount_out_balance = balance_out_without_fee.mul_down(swap_fee.complement())
```

Where `swap_fee.complement()` = `1 - swap_fee` = `1 - (57500/10^9)` = `0.9999425`

So:
```
balance_out_without_fee = amount_out_balance / 0.9999425
```

Assuming 8 decimals and no scaling:
- `amount_out_balance` ≈ 145976 (0.00145976 × 10^8, scaled to 9 decimals)
- `balance_out_without_fee` ≈ 145976 / 0.9999425 ≈ 145984.4

### Step 3: Calculate total swap fees
From code line 59:
```rust
swap_fees_balance = balance_out_without_fee - amount_out_balance
```

- `swap_fees_balance` ≈ 145984.4 - 145976 ≈ 8.4 (in wrapped units)

### Step 4: Calculate beneficiary and protocol fees
From code line 60:
```rust
beneficiary_fees_balance = swap_fees_balance.mul_down(beneficiary_fee)
```

- `beneficiary_fees_balance` = 8.4 × 0.3 ≈ 2.52 (in wrapped units)
- `protocol_fees_balance` = 8.4 - 2.52 = 5.88 (in wrapped units)

### Step 5: Convert to token units
Converting back (assuming 8 decimals, no scaling):
- Protocol fees ≈ 5.88 / 10 ≈ **0.000000059 xBTC** (approximately)

## More Precise Calculation:

Working with exact decimals:
- User output: 0.00145976 xBTC
- swap_fee rate: 57500 / 10^9 = 0.0000575
- (1 - swap_fee) = 0.9999425

If user receives 0.00145976 xBTC after fee:
- Before fee: 0.00145976 / 0.9999425 ≈ **0.001459844 xBTC**
- Total fees: 0.001459844 - 0.00145976 = **0.000000084 xBTC**

Split:
- Beneficiary (30%): 0.000000084 × 0.3 = **0.0000000252 xBTC**
- **Protocol (70%): 0.000000084 × 0.7 = 0.0000000588 xBTC**

## Answer:
**The protocol receives approximately 0.0000000588 xBTC (or ~5.88 × 10^-8 xBTC)**

This amount stays in the pool (increases LP token value), while 0.0000000252 xBTC is sent to the beneficiary address.

---

## Why You See Only 0.00000001 xBTC Transferred

### The Precision Loss Issue:

1. **Wrapped Balance Units (9 decimals)**: All calculations happen in wrapped balance units with 9 decimals
2. **Token Units (8 decimals)**: xBTC has 8 decimals
3. **Conversion**: `calc_unwrapped_amount` converts from 9 decimals → 8 decimals by dividing by 10

### Step-by-Step Precision Loss:

1. **Line 60**: `beneficiary_fees_balance = swap_fees_balance.mul_down(beneficiary_fee)`
   - `mul_down` **rounds DOWN** (this is critical!)
   - If `swap_fees_balance` ≈ 8.4 in wrapped units
   - `beneficiary_fees_balance` = 8.4 × 0.3 = 2.52 → rounds DOWN to **2** (in wrapped units)

2. **Line 74**: `beneficiary_fees = calc_unwrapped_amount(beneficiary_fees_balance, token_out_index)`
   - Converts from 9 decimals (wrapped) to 8 decimals (token)
   - If `scaling_factor == 1`: `beneficiary_fees = 2 / 10 = 0.2`
   - In integer arithmetic: **0.2 rounds down to 0** OR if there's any remainder it becomes **1**

3. **Result**: 
   - The theoretical value is ~0.0000000252 xBTC
   - But after rounding down multiple times, it becomes **0.00000001 xBTC** (1 in 8-decimal units)
   - This is the **minimum representable amount** after all the precision loss!

### Why This Happens:

- **`mul_down` always rounds DOWN** (conservative rounding to prevent over-crediting)
- **Integer division** when converting 9 decimals → 8 decimals loses precision
- **Very small amounts** (< 10 in wrapped units) get heavily impacted by rounding
- The **protocol fees** (70%) also get rounded down, but they stay in the pool so you don't see them transferred

### The Math:
- Theoretical beneficiary fee: ~2.52 in wrapped units (9 decimals)
- After `mul_down`: 2 in wrapped units  
- After conversion to 8 decimals: 2 / 10 = 0.2 → rounds to **1** (minimum)
- Final: **0.00000001 xBTC** (1 × 10^-8)

This is expected behavior for very small swap amounts - the rounding down ensures the protocol never over-credits fees, but it means tiny amounts get rounded to the minimum representable value!


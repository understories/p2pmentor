# Sign and Verify a Message

## Sign Your First Message

Now you'll use your private key to sign a message, then verify it with your public key.

## Step 1: Sign a Message

1. Enter a message (e.g., "I understand cryptography!")
2. Use your private key to sign it
3. Get your signature

[Interactive signing component]

**Your Message:**
```
[User-entered message]
```

**Your Signature:**
```
[Generated signature]
```

## Step 2: Verify the Signature

1. Enter the same message
2. Enter your public key
3. Enter the signature
4. Click "Verify"

[Interactive verification component]

**Verification Result:**
- ✅ Valid signature (message matches, signature is authentic)
- ❌ Invalid signature (message was modified or signature is fake)

## Try Breaking It

1. Sign a message
2. Change the message slightly
3. Try to verify - it should fail!
4. This proves signatures detect tampering

## Real-World Example

**Blockchain Transaction:**
```
Message: "Send 0.1 ETH to 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
Signature: [cryptographic signature]
Public Key: [your wallet address]
```

Anyone can verify you authorized this transaction without knowing your private key!

## Verification

Complete the signing and verification exercises above.

Click "Complete" when you've successfully signed and verified a message.

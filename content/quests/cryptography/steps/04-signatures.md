# Digital Signatures

## What is a Digital Signature?

A digital signature proves:
1. **Authenticity:** The message came from the signer
2. **Integrity:** The message wasn't modified
3. **Non-repudiation:** The signer can't deny signing it

## How It Works

1. **Signer** creates a hash of the message
2. **Signer** encrypts the hash with their private key (this is the signature)
3. **Verifier** decrypts the signature with signer's public key
4. **Verifier** compares decrypted hash with message hash
5. If they match, signature is valid!

## Analogy

Think of it like a wax seal on a letter:
- **Private key** = Your unique seal stamp
- **Public key** = Everyone can verify the seal is yours
- **Signature** = The seal impression
- **Message** = The letter content

## Properties

- **Can't forge:** Need private key to create valid signature
- **Publicly verifiable:** Anyone with public key can verify
- **Message-specific:** Change message = invalid signature
- **Non-repudiation:** Can't deny signing (if private key is secure)

## Use Cases

- **Blockchain transactions:** Prove you authorized a transaction
- **Software distribution:** Verify software hasn't been tampered with
- **Legal documents:** Digital signatures are legally binding
- **Email:** Prove email came from claimed sender

## Next Step

You'll create your own keypair and sign a message!

Click "Complete" to continue.

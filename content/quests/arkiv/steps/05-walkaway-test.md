# The Walkaway Test

## What is the Walkaway Test?

The **walkaway test** is a simple but powerful demonstration of data independence:

1. Create data on Arkiv
2. Stop your server completely
3. Verify the data still exists on the blockchain

If your data passes the walkaway test, it means it exists **independently** of your infrastructure.

## Why This Matters

In traditional apps:
- If the company's servers go down, your data is inaccessible
- If the company shuts down, your data might be lost
- You're locked into their infrastructure

With Arkiv:
- Your data lives on the blockchain
- It exists even if your servers are down
- It persists even if your company disappears
- Anyone can read it with a compatible client

## Running the Walkaway Test

1. **Create an entity** (if you haven't already)
2. **Note the entity key and transaction hash**
3. **Stop your local server** (Ctrl+C or close the terminal)
4. **Open the Arkiv Explorer** in a browser
5. **Search for your entity** using the transaction hash
6. **Verify it still exists** - even though your server is off!

## The Result

If you can see your entity on the Explorer after stopping your server, **you've passed the walkaway test!**

This proves:
- Your data is **decentralized** (not stored on your servers)
- Your data is **persistent** (survives server shutdowns)
- Your data is **verifiable** (anyone can check it exists)

## Real-World Implications

This means:
- Users can access their data even if your app is down
- Users can switch to a different app and still access their data
- Your data infrastructure is **composable** - multiple apps can read the same data

This is the foundation of **data sovereignty** - users own their data, not the apps.

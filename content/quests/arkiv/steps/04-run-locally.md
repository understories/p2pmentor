# Run the App Locally

## Starting the Development Server

Now that your environment is configured, let's start the app:

```bash
npm run dev
```

You should see output like:
```
  ▲ Next.js 15.x.x
  - Local:        http://localhost:3000
  - Ready in 2.3s
```

## What You Should See

1. **Open http://localhost:3000** in your browser
2. You should see the starter app interface
3. There should be example buttons to create entities
4. The app should connect to Arkiv (check the console for any errors)

## Testing Entity Creation

1. **Click "Create Entity"** or similar button
2. **Fill in the form** (if there is one)
3. **Submit** and watch the console
4. You should see:
   - Transaction hash
   - Entity key
   - Success message

## Understanding What's Happening

When you create an entity:
1. Your app sends a transaction to Arkiv
2. The transaction is confirmed on-chain
3. Indexers process the transaction (takes a few seconds)
4. Your entity becomes queryable

## Common Issues

**"Missing environment variables"**
- Check your `.env.local` file exists
- Verify variable names match exactly
- Restart the dev server after changing `.env.local`

**"Connection error"**
- Verify your `ARKIV_SPACE_ID` is correct
- Check your internet connection
- Try using `beta-launch` space ID

**"Transaction failed"**
- Check your private key is valid
- Ensure you have test funds (if required)
- Verify the space ID exists

## The Development Experience

Notice how:
- **Hot reload** works - changes appear instantly
- **Console logs** show transaction details
- **No database** - everything goes to Arkiv
- **Serverless** - your local server is just a viewer

## Next Steps

Once the app is running and you can create entities, you're ready to create your first custom entity. This is where the real learning begins!

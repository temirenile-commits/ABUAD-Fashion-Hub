<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

## Successful Deployment Protocol
To maintain 100% deployment success:
1. **Local Validation**: Always run `npm run build` locally before pushing. Ensure 0 errors and no "deprecated option" warnings.
2. **Configuration**: Keep `vercel.json` in the root to explicitly define `framework: "nextjs"`.
3. **Environment**: Ensure Supabase environment variables are consistent between `.env.local` and Vercel Dashboard.
4. **Push**: Only commit and push once local build success is confirmed.
<!-- END:nextjs-agent-rules -->

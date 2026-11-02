import { backend } from '@/lib/server/firebase-admin.mjs'
import { createMarketHandler } from '@/lib/server/market-handler.mjs'
export const runtime = 'nodejs'
export const POST = createMarketHandler({ backend })

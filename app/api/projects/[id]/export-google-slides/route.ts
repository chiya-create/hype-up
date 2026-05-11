import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json(
    {
      error: 'Not Implemented',
      message: 'Google Slides連携は準備中です。現在はPPTX出力をご利用ください。',
    },
    { status: 501 }
  )
}

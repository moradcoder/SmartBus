// app/api/ai/chat/route.ts

import { NextResponse } from 'next/server';

import {
  getAIResponse,
  type ChatMessage,
} from '@/lib/ai/chat';

export const runtime = 'nodejs';

export async function POST(
  request: Request
) {
  try {
    const body =
      await request.json();

    const message =
      typeof body?.message === 'string'
        ? body.message.trim()
        : '';

    const locale =
      typeof body?.locale === 'string'
        ? body.locale
        : 'ar';

    const history: ChatMessage[] =
      Array.isArray(body?.history)
        ? body.history
        : [];

    if (!message) {
      return NextResponse.json(
        {
          error:
            'Message is required',
        },
        {
          status: 400,
        }
      );
    }

    console.log(
      'AI request:',
      message
    );

    const response =
      await getAIResponse({
        message,
        history,
        locale,
      });

    return NextResponse.json({
      response,
    });
  } catch (error) {
    console.error(
      'AI API route error:',
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'AI request failed',
      },
      {
        status: 500,
      }
    );
  }
}
// lib/ai/chat.ts

import { supabase } from '@/lib/supabase/client';

// ============================================================
// Types
// ============================================================

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AIOptions {
  message: string;
  history?: ChatMessage[];
  locale?: string;
}

interface SmartBusContext {
  lines: any[];
  stations: any[];
  buses: any[];
  drivers: any[];
  reports: any[];
}

// ============================================================
// OpenRouter
// ============================================================

const OPENROUTER_URL =
  'https://openrouter.ai/api/v1/chat/completions';

const OPENROUTER_MODEL =
  'openai/gpt-oss-20b:free';

// ============================================================
// Main AI function
// ============================================================

export async function getAIResponse({
  message,
  history = [],
  locale = 'ar',
}: AIOptions): Promise<string> {
  const question = message.trim();

  if (!question) {
    return locale === 'ar'
      ? 'من فضلك اكتب سؤالك.'
      : 'Please enter your question.';
  }

  console.log('🤖 AI request:', question);

  // ==========================================================
  // 1. Detect intent BEFORE querying database
  // ==========================================================

  const intent = detectIntent(question);

  console.log('🧠 Intent:', intent);

  // ==========================================================
  // 2. General question
  //    NO DATABASE REQUEST
  // ==========================================================

  if (intent === 'general') {
    return await answerGeneralQuestion(
      question,
      history,
      locale
    );
  }

  // ==========================================================
  // 3. SmartBus question
  // ==========================================================

  try {
    const context =
      await getSmartBusDataByIntent(intent);

    // --------------------------------------------------------
    // Direct answers for simple database questions
    // --------------------------------------------------------

    const directAnswer =
      getDirectDatabaseAnswer(
        question,
        context,
        intent,
        locale
      );

    if (directAnswer) {
      console.log(
        '⚡ Direct database response'
      );

      return directAnswer;
    }

    // --------------------------------------------------------
    // Sanitize data before sending to AI
    // --------------------------------------------------------

    const safeContext =
      sanitizeSmartBusData(context);

    const databaseContext =
      buildDatabaseContext(
        safeContext,
        intent
      );

    // --------------------------------------------------------
    // Ask OpenRouter
    // --------------------------------------------------------

    const apiKey =
      process.env.OPENROUTER_API_KEY?.trim();

    console.log(
      '🔑 OpenRouter key loaded:',
      Boolean(apiKey)
    );

    if (!apiKey) {
      console.warn(
        '⚠️ OPENROUTER_API_KEY missing'
      );

      return getLocalFallback(
        question,
        context,
        locale
      );
    }

    try {
      const answer =
        await callOpenRouter({
          apiKey,
          message: question,
          history,
          locale,
          databaseContext,
        });

      if (answer) {
        console.log(
          '✅ OpenRouter response received'
        );

        return answer;
      }
    } catch (error) {
      console.error(
        '❌ OpenRouter failed:',
        error
      );
    }

    // --------------------------------------------------------
    // Local fallback
    // --------------------------------------------------------

    return getLocalFallback(
      question,
      context,
      locale
    );
  } catch (error) {
    console.error(
      '❌ SmartBus data error:',
      error
    );

    return getLocalFallback(
      question,
      {
        lines: [],
        stations: [],
        buses: [],
        drivers: [],
        reports: [],
      },
      locale
    );
  }
}

// ============================================================
// Intent detection
// ============================================================

type Intent =
  | 'general'
  | 'lines'
  | 'stations'
  | 'buses'
  | 'drivers'
  | 'reports'
  | 'smartbus';

function detectIntent(
  question: string
): Intent {
  const q =
    question.toLowerCase().trim();

  // ----------------------------------------------------------
  // Drivers
  // ----------------------------------------------------------

  if (
    /driver|drivers|chauffeur|chauffeurs|conducteur|conducteurs|سائق|السائق|السائقين|السائقون/i.test(
      q
    )
  ) {
    return 'drivers';
  }

  // ----------------------------------------------------------
  // Lines
  // ----------------------------------------------------------

  if (
    /line|lines|ligne|lignes|route|routes|خط|خطوط|الخط/i.test(
      q
    )
  ) {
    return 'lines';
  }

  // ----------------------------------------------------------
  // Stations
  // ----------------------------------------------------------

  if (
    /station|stations|stop|stops|arrêt|arrêts|محطة|محطات/i.test(
      q
    )
  ) {
    return 'stations';
  }

  // ----------------------------------------------------------
  // Buses
  // ----------------------------------------------------------

  if (
    /bus|buses|حافلة|حافلات|حافل|gps|position|location|موقع|سرعة|speed|plate|plaque/i.test(
      q
    )
  ) {
    return 'buses';
  }

  // ----------------------------------------------------------
  // Reports
  // ----------------------------------------------------------

  if (
    /report|reports|problem|problème|problèmes|مشكل|مشاكل|بلاغ|بلاغات/i.test(
      q
    )
  ) {
    return 'reports';
  }

  // ----------------------------------------------------------
  // SmartBus general
  // ----------------------------------------------------------

  if (
    /smartbus|transport|transportation|نقل|النقل/i.test(
      q
    )
  ) {
    return 'smartbus';
  }

  // ----------------------------------------------------------
  // Everything else = general AI
  // ----------------------------------------------------------

  return 'general';
}

// ============================================================
// General AI question
// ============================================================

async function answerGeneralQuestion(
  question: string,
  history: ChatMessage[],
  locale: string
): Promise<string> {
  const apiKey =
    process.env.OPENROUTER_API_KEY?.trim();

  if (!apiKey) {
    return getGeneralFallback(
      question,
      locale
    );
  }

  try {
    const answer =
      await callOpenRouter({
        apiKey,
        message: question,
        history,
        locale,
        databaseContext:
          'No SmartBus database information is required for this question.',
      });

    if (answer) {
      return answer;
    }
  } catch (error) {
    console.error(
      'General AI error:',
      error
    );
  }

  return getGeneralFallback(
    question,
    locale
  );
}

// ============================================================
// OpenRouter request
// ============================================================

async function callOpenRouter({
  apiKey,
  message,
  history,
  locale,
  databaseContext,
}: {
  apiKey: string;
  message: string;
  history: ChatMessage[];
  locale: string;
  databaseContext: string;
}): Promise<string | null> {
  const systemPrompt = `
You are SmartBus AI.

You are a helpful general-purpose AI assistant integrated
into the SmartBus application.

IMPORTANT RULES:

1. You can answer ANY normal question.
2. You are NOT limited to transportation.
3. You can answer questions about:
   - programming
   - AI
   - technology
   - mathematics
   - science
   - education
   - general knowledge
   - languages
   - writing
   - translation
   - everyday questions

4. When the question concerns SmartBus, use ONLY the
   SmartBus information provided below.

5. NEVER invent SmartBus information.

6. NEVER reveal internal database identifiers.

7. NEVER reveal:
   - UUIDs
   - user IDs
   - authentication IDs
   - emails
   - phone numbers
   - passwords
   - tokens
   - latitude
   - longitude
   - private addresses
   - internal database fields
   - private administrative information

8. If information is not available, say that it is
   currently unavailable.

9. Do not mention internal database implementation
   details to the user.

10. Answer naturally and concisely.

11. Use Markdown when useful.

LANGUAGE:

- Arabic → Arabic.
- Moroccan Darija → Moroccan Darija.
- French → French.
- English → English.
- Mixed language → use the dominant language.

Current locale:
${locale}

SAFE SMARTBUS INFORMATION:

${databaseContext}
`.trim();

  // Only send recent messages
  const safeHistory =
    history
      .filter(
        (item) =>
          item &&
          (item.role === 'user' ||
            item.role === 'assistant') &&
          typeof item.content === 'string' &&
          item.content.trim()
      )
      .slice(-5);

  const messages = [
    {
      role: 'system',
      content: systemPrompt,
    },

    ...safeHistory,

    {
      role: 'user',
      content: message,
    },
  ];

  const response =
    await fetch(
      OPENROUTER_URL,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',

          Authorization:
            `Bearer ${apiKey}`,

          'HTTP-Referer':
            process.env.NEXT_PUBLIC_APP_URL ||
            'http://localhost:3000',

          'X-Title':
            'SmartBus AI',
        },

        body: JSON.stringify({
          model:
            OPENROUTER_MODEL,

          messages,

          temperature: 0.5,

          // Smaller = faster
          max_tokens: 600,
        }),

        cache: 'no-store',
      }
    );

  if (!response.ok) {
    const errorText =
      await response.text();

    console.error(
      'OpenRouter API Error:',
      response.status,
      errorText
    );

    throw new Error(
      `OpenRouter API error: ${response.status}`
    );
  }

  const data =
    await response.json();

  const answer =
    data?.choices?.[0]?.message?.content;

  if (
    !answer ||
    typeof answer !== 'string'
  ) {
    throw new Error(
      'Empty AI response'
    );
  }

  return answer.trim();
}

// ============================================================
// SmartBus database
// ============================================================

async function getSmartBusDataByIntent(
  intent: Intent
): Promise<SmartBusContext> {
  const empty: SmartBusContext = {
    lines: [],
    stations: [],
    buses: [],
    drivers: [],
    reports: [],
  };

  try {
    switch (intent) {
      // ------------------------------------------------------
      // Drivers
      // ------------------------------------------------------

      case 'drivers': {
        const result =
          await supabase
            .from('drivers')
            .select('*')
            .limit(50);

        if (result.error) {
          console.warn(
            'drivers:',
            result.error.message
          );
        }

        return {
          ...empty,
          drivers:
            result.data || [],
        };
      }

      // ------------------------------------------------------
      // Lines
      // ------------------------------------------------------

      case 'lines': {
        const result =
          await supabase
            .from('lines')
            .select('*')
            .limit(50);

        if (result.error) {
          console.warn(
            'lines:',
            result.error.message
          );
        }

        return {
          ...empty,
          lines:
            result.data || [],
        };
      }

      // ------------------------------------------------------
      // Stations
      // ------------------------------------------------------

      case 'stations': {
        const result =
          await supabase
            .from('stations')
            .select('*')
            .limit(100);

        if (result.error) {
          console.warn(
            'stations:',
            result.error.message
          );
        }

        return {
          ...empty,
          stations:
            result.data || [],
        };
      }

      // ------------------------------------------------------
      // Buses
      // ------------------------------------------------------

      case 'buses':
      case 'smartbus': {
        const result =
          await supabase
            .from('buses')
            .select('*')
            .limit(50);

        if (result.error) {
          console.warn(
            'buses:',
            result.error.message
          );
        }

        return {
          ...empty,
          buses:
            result.data || [],
        };
      }

      // ------------------------------------------------------
      // Reports
      // ------------------------------------------------------

      case 'reports': {
        const result =
          await supabase
            .from('reports')
            .select('*')
            .limit(50);

        if (result.error) {
          console.warn(
            'reports:',
            result.error.message
          );
        }

        return {
          ...empty,
          reports:
            result.data || [],
        };
      }

      default:
        return empty;
    }
  } catch (error) {
    console.error(
      'Supabase error:',
      error
    );

    return empty;
  }
}

// ============================================================
// Remove sensitive information
// ============================================================

function sanitizeSmartBusData(
  context: SmartBusContext
): SmartBusContext {
  return {
    lines:
      context.lines.map(
        (line: any) => ({
          number:
            line.number ??
            line.line_number ??
            null,

          name:
            line.name ??
            null,

          name_ar:
            line.name_ar ??
            null,

          name_fr:
            line.name_fr ??
            null,

          status:
            line.status ??
            null,
        })
      ),

    stations:
      context.stations.map(
        (station: any) => ({
          name:
            station.name ??
            null,

          name_ar:
            station.name_ar ??
            null,

          name_fr:
            station.name_fr ??
            null,

          status:
            station.status ??
            null,
        })
      ),

    buses:
      context.buses.map(
        (bus: any) => ({
          plate:
            bus.plate ??
            bus.license_plate ??
            null,

          model:
            bus.model ??
            null,

          capacity:
            bus.capacity ??
            null,

          status:
            bus.status ??
            null,

          speed:
            bus.speed ??
            null,

          gps_active:
            bus.gps_active ??
            null,

          direction:
            bus.direction ??
            bus.heading ??
            null,

          // IMPORTANT:
          // latitude/longitude intentionally excluded
        })
      ),

    drivers:
      context.drivers.map(
        (driver: any) => ({
          name:
            driver.name ??
            driver.full_name ??
            null,

          status:
            driver.status ??
            null,
        })
      ),

    reports:
      context.reports.map(
        (report: any) => ({
          title:
            report.title ??
            null,

          type:
            report.type ??
            null,

          status:
            report.status ??
            null,
        })
      ),
  };
}

// ============================================================
// Build safe context
// ============================================================

function buildDatabaseContext(
  context: SmartBusContext,
  intent: Intent
): string {
  const sections: string[] = [];

  if (
    intent === 'lines' &&
    context.lines.length
  ) {
    sections.push(
      `LINES:\n${JSON.stringify(
        context.lines,
        null,
        2
      )}`
    );
  }

  if (
    intent === 'stations' &&
    context.stations.length
  ) {
    sections.push(
      `STATIONS:\n${JSON.stringify(
        context.stations,
        null,
        2
      )}`
    );
  }

  if (
    (intent === 'buses' ||
      intent === 'smartbus') &&
    context.buses.length
  ) {
    sections.push(
      `BUSES:\n${JSON.stringify(
        context.buses,
        null,
        2
      )}`
    );
  }

  if (
    intent === 'drivers' &&
    context.drivers.length
  ) {
    sections.push(
      `DRIVERS:\n${JSON.stringify(
        context.drivers,
        null,
        2
      )}`
    );
  }

  if (
    intent === 'reports' &&
    context.reports.length
  ) {
    sections.push(
      `REPORTS:\n${JSON.stringify(
        context.reports,
        null,
        2
      )}`
    );
  }

  return sections.length
    ? sections.join('\n\n')
    : 'No relevant information is available.';
}

// ============================================================
// Direct database answers
// ============================================================

function getDirectDatabaseAnswer(
  question: string,
  context: SmartBusContext,
  intent: Intent,
  locale: string
): string | null {
  const q =
    question.toLowerCase();

  // ----------------------------------------------------------
  // Driver names
  // ----------------------------------------------------------

  if (
    intent === 'drivers' &&
    /name|names|nom|noms|اسم|أسماء|اسماء|شكون|شكون هما/i.test(
      q
    )
  ) {
    if (!context.drivers.length) {
      return locale === 'ar'
        ? '👨‍✈️ لا توجد أسماء سائقين متاحة حالياً.'
        : locale === 'fr'
        ? '👨‍✈️ Aucun nom de chauffeur disponible.'
        : '👨‍✈️ No driver names are currently available.';
    }

    const names =
      context.drivers
        .map(
          (driver: any) =>
            driver.name ||
            driver.full_name
        )
        .filter(Boolean)
        .slice(0, 50);

    if (!names.length) {
      return locale === 'ar'
        ? '👨‍✈️ لا توجد أسماء سائقين متاحة.'
        : 'No driver names are available.';
    }

    const list =
      names
        .map(
          (name) =>
            `• ${name}`
        )
        .join('\n');

    return locale === 'ar'
      ? `👨‍✈️ **سائقو SmartBus:**\n\n${list}`
      : locale === 'fr'
      ? `👨‍✈️ **Chauffeurs SmartBus :**\n\n${list}`
      : `👨‍✈️ **SmartBus Drivers:**\n\n${list}`;
  }

  // ----------------------------------------------------------
  // Number of drivers
  // ----------------------------------------------------------

  if (
    intent === 'drivers' &&
    /how many|combien|عدد|كم/i.test(q)
  ) {
    return locale === 'ar'
      ? `👨‍✈️ يوجد ${context.drivers.length} سائقاً مسجلاً.`
      : locale === 'fr'
      ? `👨‍✈️ Il y a ${context.drivers.length} chauffeurs enregistrés.`
      : `👨‍✈️ There are ${context.drivers.length} registered drivers.`;
  }

  // ----------------------------------------------------------
  // Lines
  // ----------------------------------------------------------

  if (
    intent === 'lines' &&
    /how many|combien|عدد|كم/i.test(q)
  ) {
    return locale === 'ar'
      ? `🚌 يوجد ${context.lines.length} خطاً متاحاً.`
      : locale === 'fr'
      ? `🚌 Il y a ${context.lines.length} lignes disponibles.`
      : `🚌 There are ${context.lines.length} available lines.`;
  }

  // ----------------------------------------------------------
  // Stations
  // ----------------------------------------------------------

  if (
    intent === 'stations' &&
    /how many|combien|عدد|كم/i.test(q)
  ) {
    return locale === 'ar'
      ? `📍 يوجد ${context.stations.length} محطة.`
      : locale === 'fr'
      ? `📍 Il y a ${context.stations.length} stations.`
      : `📍 There are ${context.stations.length} stations.`;
  }

  // ----------------------------------------------------------
  // Buses
  // ----------------------------------------------------------

  if (
    intent === 'buses' &&
    /how many|combien|عدد|كم/i.test(q)
  ) {
    return locale === 'ar'
      ? `🚌 يوجد ${context.buses.length} حافلة في البيانات المتاحة.`
      : locale === 'fr'
      ? `🚌 Il y a ${context.buses.length} bus dans les données disponibles.`
      : `🚌 There are ${context.buses.length} buses in the available data.`;
  }

  return null;
}

// ============================================================
// Local SmartBus fallback
// ============================================================

function getLocalFallback(
  question: string,
  context: SmartBusContext,
  locale: string
): string {
  const q =
    question.toLowerCase();

  // ----------------------------------------------------------
  // Drivers
  // ----------------------------------------------------------

  if (
    /driver|drivers|chauffeur|chauffeurs|sائق|سائق|السائقين/i.test(
      q
    )
  ) {
    if (!context.drivers.length) {
      return locale === 'ar'
        ? '👨‍✈️ لا توجد معلومات عن السائقين حالياً.'
        : 'No driver information is currently available.';
    }

    const names =
      context.drivers
        .map(
          (driver: any) =>
            driver.name ||
            driver.full_name
        )
        .filter(Boolean)
        .join('\n');

    return locale === 'ar'
      ? `👨‍✈️ **السائقون:**\n\n${names
          .split('\n')
          .map(
            (x) => `• ${x}`
          )
          .join('\n')}`
      : `👨‍✈️ **Drivers:**\n\n${names
          .split('\n')
          .map(
            (x) => `• ${x}`
          )
          .join('\n')}`;
  }

  // ----------------------------------------------------------
  // Lines
  // ----------------------------------------------------------

  if (
    /line|ligne|lines|lignes|خط|خطوط/i.test(
      q
    )
  ) {
    if (!context.lines.length) {
      return locale === 'ar'
        ? '🚌 لا توجد معلومات عن الخطوط حالياً.'
        : 'No line information is currently available.';
    }

    return locale === 'ar'
      ? `🚌 يوجد ${context.lines.length} خطاً متاحاً.`
      : `🚌 ${context.lines.length} lines are available.`;
  }

  // ----------------------------------------------------------
  // Stations
  // ----------------------------------------------------------

  if (
    /station|stations|stop|arrêt|محطة|محطات/i.test(
      q
    )
  ) {
    if (!context.stations.length) {
      return locale === 'ar'
        ? '📍 لا توجد معلومات عن المحطات.'
        : 'No station information is available.';
    }

    return locale === 'ar'
      ? `📍 يوجد ${context.stations.length} محطة.`
      : `📍 ${context.stations.length} stations are available.`;
  }

  // ----------------------------------------------------------
  // Buses
  // ----------------------------------------------------------

  if (
    /bus|buses|حافلة|حافلات|gps|speed|سرعة|موقع/i.test(
      q
    )
  ) {
    if (!context.buses.length) {
      return locale === 'ar'
        ? '🚌 لا توجد معلومات عن الحافلات حالياً.'
        : 'No bus information is available.';
    }

    return locale === 'ar'
      ? `🚌 يوجد ${context.buses.length} حافلة في البيانات المتاحة.`
      : `🚌 ${context.buses.length} buses are available.`;
  }

  return locale === 'ar'
    ? '🤖 الذكاء الاصطناعي غير متاح مؤقتاً، ولكن نظام SmartBus المحلي يعمل.'
    : locale === 'fr'
    ? '🤖 Le service IA est temporairement indisponible, mais le système local SmartBus fonctionne.'
    : '🤖 AI is temporarily unavailable, but the local SmartBus system is working.';
}

// ============================================================
// General local fallback
// ============================================================

function getGeneralFallback(
  question: string,
  locale: string
): string {
  const q =
    question.toLowerCase();

  if (
    /^(hi|hello|hey|bonjour|salut|مرحبا|السلام|سلام|اهلا|أهلا)/i.test(
      q
    )
  ) {
    return locale === 'ar'
      ? '👋 مرحباً! أنا SmartBus AI. كيف يمكنني مساعدتك؟'
      : locale === 'fr'
      ? '👋 Bonjour ! Je suis SmartBus AI. Comment puis-je vous aider ?'
      : '👋 Hello! I am SmartBus AI. How can I help you?';
  }

  if (
    /who are you|qui es-tu|من أنت|شكون نتا|شنو نتا/i.test(
      q
    )
  ) {
    return locale === 'ar'
      ? '🤖 أنا SmartBus AI، مساعد ذكي داخل منصة SmartBus.'
      : '🤖 I am SmartBus AI, the intelligent assistant inside SmartBus.';
  }

  return locale === 'ar'
    ? '🤖 لا أستطيع الاتصال بخدمة الذكاء الاصطناعي حالياً. حاول مرة أخرى بعد قليل.'
    : locale === 'fr'
    ? '🤖 Je ne peux pas contacter le service IA pour le moment. Réessayez plus tard.'
    : '🤖 I cannot connect to the AI service right now. Please try again later.';
}
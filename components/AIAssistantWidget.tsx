// components/ai/ai-assistant-widget.tsx

'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  Bot,
  X,
  Send,
  Trash2,
  Sparkles,
  Loader2,
} from 'lucide-react';

// ============================================================
// TYPES
// ============================================================

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface AIAssistantWidgetProps {
  locale?: string;
}

// ============================================================
// COMPONENT
// ============================================================

export default function AIAssistantWidget({
  locale = 'ar',
}: AIAssistantWidgetProps) {
  // ==========================================================
  // STATE
  // ==========================================================

  const [open, setOpen] = useState(false);

  const [input, setInput] = useState('');

  const [loading, setLoading] = useState(false);

  const [messages, setMessages] = useState<
    ChatMessage[]
  >([
    {
      role: 'assistant',

      content:
        locale === 'ar'
          ? '👋 مرحباً! أنا SmartBus AI. يمكنك أن تسألني عن SmartBus أو عن أي موضوع آخر.'
          : locale === 'fr'
          ? '👋 Bonjour ! Je suis SmartBus AI. Vous pouvez me poser des questions sur SmartBus ou sur n’importe quel autre sujet.'
          : '👋 Hello! I am SmartBus AI. You can ask me about SmartBus or any other topic.',

      timestamp:
        new Date().toISOString(),
    },
  ]);

  // ==========================================================
  // SCROLL
  // ==========================================================

  const messagesEndRef =
    useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
    });
  }, [messages, loading]);

  // ==========================================================
  // SEND MESSAGE
  // ==========================================================

  const handleSend = useCallback(async () => {
    const text = input.trim();

    if (!text || loading) {
      return;
    }

    // --------------------------------------------------------
    // Save history BEFORE adding current message
    // --------------------------------------------------------

    const history = messages
      .slice(-10)
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));

    // --------------------------------------------------------
    // User message
    // --------------------------------------------------------

    const userMessage: ChatMessage = {
      role: 'user',
      content: text,
      timestamp:
        new Date().toISOString(),
    };

    setMessages((prev) => [
      ...prev,
      userMessage,
    ]);

    setInput('');

    setLoading(true);

    // --------------------------------------------------------
    // API
    // --------------------------------------------------------

    try {
      const response = await fetch(
        '/api/ai/chat',
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
          },

          body: JSON.stringify({
            message: text,
            history,
            locale,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'AI request failed.'
        );
      }

      if (
        !data?.response ||
        typeof data.response !== 'string'
      ) {
        throw new Error(
          'Invalid AI response.'
        );
      }

      // ------------------------------------------------------
      // Assistant message
      // ------------------------------------------------------

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.response,
        timestamp:
          new Date().toISOString(),
      };

      setMessages((prev) => [
        ...prev,
        assistantMessage,
      ]);
    } catch (error) {
      console.error(
        'SmartBus AI error:',
        error
      );

      const errorMessage: ChatMessage = {
        role: 'assistant',

        content:
          locale === 'ar'
            ? '❌ عذراً، وقع خطأ أثناء الاتصال بالذكاء الاصطناعي. حاول مرة أخرى.'
            : locale === 'fr'
            ? '❌ Désolé, une erreur est survenue. Veuillez réessayer.'
            : '❌ Sorry, something went wrong. Please try again.',

        timestamp:
          new Date().toISOString(),
      };

      setMessages((prev) => [
        ...prev,
        errorMessage,
      ]);
    } finally {
      setLoading(false);
    }
  }, [
    input,
    loading,
    messages,
    locale,
  ]);

  // ==========================================================
  // ENTER KEY
  // ==========================================================

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (
      event.key === 'Enter' &&
      !event.shiftKey
    ) {
      event.preventDefault();

      handleSend();
    }
  };

  // ==========================================================
  // CLEAR
  // ==========================================================

  const clearConversation = () => {
    setMessages([
      {
        role: 'assistant',

        content:
          locale === 'ar'
            ? '👋 تم مسح المحادثة. كيف يمكنني مساعدتك؟'
            : locale === 'fr'
            ? '👋 Conversation effacée. Comment puis-je vous aider ?'
            : '👋 Conversation cleared. How can I help you?',

        timestamp:
          new Date().toISOString(),
      },
    ]);
  };

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <>
      {/* ====================================================
          FLOATING BUTTON
      ==================================================== */}

      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open SmartBus AI"
          className="
            fixed
            bottom-6
            right-6
            z-[9999]
            flex
            h-14
            w-14
            items-center
            justify-center
            rounded-full
            bg-blue-600
            text-white
            shadow-xl
            transition-all
            duration-200
            hover:scale-105
            hover:bg-blue-700
            active:scale-95
          "
        >
          <Bot size={26} />

          <span
            className="
              absolute
              right-0
              top-0
              h-3
              w-3
              rounded-full
              bg-green-400
              ring-2
              ring-white
            "
          />
        </button>
      )}

      {/* ====================================================
          CHAT WINDOW
      ==================================================== */}

      {open && (
        <div
          dir={
            locale === 'ar'
              ? 'rtl'
              : 'ltr'
          }
          className="
            fixed
            bottom-5
            right-5
            z-[9999]
            flex
            h-[min(700px,calc(100vh-40px))]
            w-[min(420px,calc(100vw-40px))]
            flex-col
            overflow-hidden
            rounded-2xl
            border
            border-gray-200
            bg-white
            shadow-2xl
            dark:border-gray-700
            dark:bg-gray-900
          "
        >
          {/* ==================================================
              HEADER
          ================================================== */}

          <div
            className="
              flex
              items-center
              justify-between
              bg-gradient-to-r
              from-blue-600
              to-indigo-600
              px-4
              py-3
              text-white
            "
          >
            <div className="flex items-center gap-3">
              <div
                className="
                  flex
                  h-10
                  w-10
                  items-center
                  justify-center
                  rounded-full
                  bg-white/20
                "
              >
                <Sparkles size={21} />
              </div>

              <div>
                <h3 className="font-semibold">
                  SmartBus AI
                </h3>

                <div className="flex items-center gap-1.5 text-xs text-white/80">
                  <span
                    className="
                      h-2
                      w-2
                      rounded-full
                      bg-green-300
                    "
                  />

                  {locale === 'ar'
                    ? 'متصل'
                    : locale === 'fr'
                    ? 'En ligne'
                    : 'Online'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={clearConversation}
                aria-label="Clear conversation"
                className="
                  rounded-lg
                  p-2
                  hover:bg-white/10
                "
              >
                <Trash2 size={18} />
              </button>

              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close SmartBus AI"
                className="
                  rounded-lg
                  p-2
                  hover:bg-white/10
                "
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* ==================================================
              MESSAGES
          ================================================== */}

          <div
            className="
              flex-1
              space-y-4
              overflow-y-auto
              bg-gray-50
              p-4
              dark:bg-gray-950
            "
          >
            {messages.map(
              (message, index) => {
                const isUser =
                  message.role === 'user';

                return (
                  <div
                    key={`${message.timestamp}-${index}`}
                    className={
                      isUser
                        ? 'flex justify-end'
                        : 'flex justify-start'
                    }
                  >
                    <div
                      className={`
                        max-w-[85%]
                        whitespace-pre-wrap
                        break-words
                        rounded-2xl
                        px-4
                        py-3
                        text-sm
                        leading-6
                        ${
                          isUser
                            ? 'rounded-br-md bg-blue-600 text-white'
                            : 'rounded-bl-md bg-white text-gray-800 shadow-sm dark:bg-gray-800 dark:text-gray-100'
                        }
                      `}
                    >
                      {message.content}
                    </div>
                  </div>
                );
              }
            )}

            {/* Loading */}

            {loading && (
              <div className="flex justify-start">
                <div
                  className="
                    flex
                    items-center
                    gap-2
                    rounded-2xl
                    rounded-bl-md
                    bg-white
                    px-4
                    py-3
                    text-gray-600
                    shadow-sm
                    dark:bg-gray-800
                    dark:text-gray-300
                  "
                >
                  <Loader2
                    size={17}
                    className="animate-spin"
                  />

                  <span className="text-sm">
                    {locale === 'ar'
                      ? 'يفكر...'
                      : locale === 'fr'
                      ? 'Réflexion...'
                      : 'Thinking...'}
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ==================================================
              INPUT
          ================================================== */}

          <div
            className="
              border-t
              border-gray-200
              bg-white
              p-3
              dark:border-gray-700
              dark:bg-gray-900
            "
          >
            <div
              className="
                flex
                items-end
                gap-2
                rounded-xl
                border
                border-gray-300
                bg-gray-50
                p-2
                focus-within:border-blue-500
                dark:border-gray-600
                dark:bg-gray-800
              "
            >
              <textarea
                value={input}
                onChange={(event) =>
                  setInput(
                    event.target.value
                  )
                }
                onKeyDown={handleKeyDown}
                disabled={loading}
                rows={1}
                placeholder={
                  locale === 'ar'
                    ? 'اسألني أي شيء...'
                    : locale === 'fr'
                    ? 'Posez-moi une question...'
                    : 'Ask me anything...'
                }
                className="
                  min-h-[42px]
                  max-h-32
                  flex-1
                  resize-none
                  border-0
                  bg-transparent
                  px-2
                  py-2
                  text-sm
                  text-gray-900
                  outline-none
                  placeholder:text-gray-400
                  dark:text-white
                "
              />

              <button
                type="button"
                onClick={handleSend}
                disabled={
                  loading ||
                  !input.trim()
                }
                aria-label="Send message"
                className="
                  flex
                  h-10
                  w-10
                  shrink-0
                  items-center
                  justify-center
                  rounded-lg
                  bg-blue-600
                  text-white
                  transition
                  hover:bg-blue-700
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                "
              >
                {loading ? (
                  <Loader2
                    size={18}
                    className="animate-spin"
                  />
                ) : (
                  <Send size={18} />
                )}
              </button>
            </div>

            <p
              className="
                mt-2
                text-center
                text-[10px]
                text-gray-400
              "
            >
              SmartBus AI
            </p>
          </div>
        </div>
      )}
    </>
  );
}
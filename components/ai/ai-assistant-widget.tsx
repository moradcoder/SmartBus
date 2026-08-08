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

interface Props {
  locale?: string;
}

// ============================================================
// COMPONENT
// ============================================================

export default function AIAssistantWidget({
  locale = 'ar',
}: Props) {
  const [open, setOpen] =
    useState(false);

  const [input, setInput] =
    useState('');

  const [loading, setLoading] =
    useState(false);

  const [messages, setMessages] =
    useState<ChatMessage[]>([
      {
        role: 'assistant',
        content:
          locale === 'ar'
            ? '👋 مرحباً! أنا SmartBus AI. يمكنك أن تسألني عن SmartBus أو عن أي موضوع آخر.'
            : locale === 'fr'
            ? '👋 Bonjour ! Je suis SmartBus AI. Posez-moi vos questions sur SmartBus ou sur n’importe quel autre sujet.'
            : '👋 Hello! I am SmartBus AI. Ask me about SmartBus or anything else.',
        timestamp:
          new Date().toISOString(),
      },
    ]);

  const messagesEndRef =
    useRef<HTMLDivElement>(null);

  // ==========================================================
  // AUTO SCROLL
  // ==========================================================

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
    });
  }, [
    messages,
    loading,
  ]);

  // ==========================================================
  // SEND
  // ==========================================================

  const handleSend =
    useCallback(async () => {
      const text =
        input.trim();

      if (
        !text ||
        loading
      ) {
        return;
      }

      // History BEFORE current message
      const history =
        messages
          .slice(-10)
          .map((m) => ({
            role: m.role,
            content: m.content,
          }));

      // User message
      const userMessage: ChatMessage = {
        role: 'user',
        content: text,
        timestamp:
          new Date().toISOString(),
      };

      setMessages(
        (prev) => [
          ...prev,
          userMessage,
        ]
      );

      setInput('');
      setLoading(true);

      try {
        const response =
          await fetch(
            '/api/ai/chat',
            {
              method: 'POST',

              headers: {
                'Content-Type':
                  'application/json',
              },

              body: JSON.stringify({
                message: text,
                history,
                locale,
              }),
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ||
              'AI request failed'
          );
        }

        if (
          !data?.response
        ) {
          throw new Error(
            'Empty AI response'
          );
        }

        const assistantMessage: ChatMessage =
          {
            role: 'assistant',
            content:
              data.response,
            timestamp:
              new Date().toISOString(),
          };

        setMessages(
          (prev) => [
            ...prev,
            assistantMessage,
          ]
        );
      } catch (error) {
        console.error(
          'SmartBus AI:',
          error
        );

        setMessages(
          (prev) => [
            ...prev,
            {
              role: 'assistant',
              content:
                locale === 'ar'
                  ? '❌ عذراً، حدث خطأ أثناء الاتصال بالذكاء الاصطناعي.'
                  : locale === 'fr'
                  ? '❌ Désolé, une erreur est survenue.'
                  : '❌ Sorry, an error occurred.',
              timestamp:
                new Date().toISOString(),
            },
          ]
        );
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
  // ENTER
  // ==========================================================

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (
      e.key === 'Enter' &&
      !e.shiftKey
    ) {
      e.preventDefault();

      handleSend();
    }
  };

  // ==========================================================
  // CLEAR
  // ==========================================================

  const clearChat = () => {
    setMessages([
      {
        role: 'assistant',
        content:
          locale === 'ar'
            ? '👋 تم مسح المحادثة. كيف يمكنني مساعدتك؟'
            : locale === 'fr'
            ? '👋 Conversation effacée. Comment puis-je vous aider ?'
            : '👋 Conversation cleared. How can I help?',
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
      {!open && (
        <button
          type="button"
          onClick={() =>
            setOpen(true)
          }
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
            transition
            hover:scale-105
            hover:bg-blue-700
          "
          aria-label="Open AI"
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
          {/* HEADER */}

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

                <div className="text-xs opacity-80">
                  {locale === 'ar'
                    ? 'مساعد ذكي'
                    : locale === 'fr'
                    ? 'Assistant intelligent'
                    : 'AI Assistant'}
                </div>
              </div>
            </div>

            <div className="flex gap-1">
              <button
                type="button"
                onClick={clearChat}
                className="rounded-lg p-2 hover:bg-white/10"
                aria-label="Clear"
              >
                <Trash2 size={18} />
              </button>

              <button
                type="button"
                onClick={() =>
                  setOpen(false)
                }
                className="rounded-lg p-2 hover:bg-white/10"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* MESSAGES */}

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
                  message.role ===
                  'user';

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

            {loading && (
              <div className="flex justify-start">
                <div
                  className="
                    flex
                    items-center
                    gap-2
                    rounded-2xl
                    bg-white
                    px-4
                    py-3
                    shadow-sm
                    dark:bg-gray-800
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

          {/* INPUT */}

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
                onChange={(e) =>
                  setInput(
                    e.target.value
                  )
                }
                onKeyDown={
                  handleKeyDown
                }
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
                  bg-transparent
                  px-2
                  py-2
                  text-sm
                  outline-none
                  dark:text-white
                "
              />

              <button
                type="button"
                onClick={
                  handleSend
                }
                disabled={
                  loading ||
                  !input.trim()
                }
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
                  hover:bg-blue-700
                  disabled:opacity-50
                "
                aria-label="Send"
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
          </div>
        </div>
      )}
    </>
  );
}
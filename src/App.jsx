import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Menu,
  MessageSquare,
  Plus,
  SendHorizonal,
  Trash2,
  User,
  X,
} from "lucide-react";
import clsx from "clsx";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

const STORAGE_KEY = "vite-ai-chat-chats";
const ACTIVE_CHAT_KEY = "vite-ai-chat-active";

const API_BASE_URL = import.meta.env.VITE_AI_BASE_URL;
const API_KEY = import.meta.env.VITE_AI_API_KEY;
const MODEL = import.meta.env.VITE_AI_MODEL || "Qwen3-30B-A3B";


function createChat() {
  return {
    id: crypto.randomUUID(),
    title: "New Chat",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
  };
}

function loadChats() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const first = createChat();
      localStorage.setItem(STORAGE_KEY, JSON.stringify([first]));
      localStorage.setItem(ACTIVE_CHAT_KEY, first.id);
      return [first];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [createChat()];
    }

    return parsed;
  } catch {
    return [createChat()];
  }
}

function MarkdownMessage({ content }) {
  return (
    <div className="prose prose-invert max-w-none prose-pre:!bg-transparent prose-p:my-2 prose-code:text-white">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            if (!inline && match) {
              return (
                <SyntaxHighlighter
                  style={oneDark}
                  language={match[1]}
                  PreTag="div"
                  customStyle={{
                    margin: 0,
                    borderRadius: "12px",
                    padding: "1rem",
                    background: "#0f172a",
                  }}
                  {...props}
                >
                  {String(children).replace(/\n$/, "")}
                </SyntaxHighlighter>
              );
            }

            return (
              <code
                className="rounded bg-white/10 px-1.5 py-0.5 text-sm"
                {...props}
              >
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function TypingMarkdown({ content, onDone }) {
  const [visibleText, setVisibleText] = useState("");

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      i += 1;
      setVisibleText(content.slice(0, i));
      if (i >= content.length) {
        clearInterval(interval);
        onDone?.();
      }
    }, 8);

    return () => clearInterval(interval);
  }, [content, onDone]);

  return <MarkdownMessage content={visibleText} />;
}

export default function App() {
  const [chats, setChats] = useState(loadChats);
  const [activeChatId, setActiveChatId] = useState(
    localStorage.getItem(ACTIVE_CHAT_KEY) || loadChats()[0]?.id
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [animatedMessageId, setAnimatedMessageId] = useState(null);

  const textareaRef = useRef(null);
  const bottomRef = useRef(null);

  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeChatId),
    [chats, activeChatId]
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
  }, [chats]);

  useEffect(() => {
    if (activeChatId) {
      localStorage.setItem(ACTIVE_CHAT_KEY, activeChatId);
    }
  }, [activeChatId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats, loading]);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height = `${Math.min(
      textareaRef.current.scrollHeight,
      180
    )}px`;
  }, [input]);

  const updateChat = (chatId, updater) => {
    setChats((prev) =>
      prev.map((chat) => {
        if (chat.id !== chatId) return chat;

        const nextMessages =
          typeof updater === "function" ? updater(chat.messages) : updater;

        const firstUserMessage = nextMessages.find(
          (m) => m.role === "user" && m.content?.trim()
        )?.content;

        const title =
          (chat.title === "New Chat" || !chat.title?.trim()) && firstUserMessage
            ? firstUserMessage.slice(0, 40)
            : chat.title;

        return {
          ...chat,
          title,
          messages: nextMessages,
          updatedAt: Date.now(),
        };
      })
    );
  };

  const handleNewChat = () => {
    const chat = createChat();
    setChats((prev) => [chat, ...prev]);
    setActiveChatId(chat.id);
    setSidebarOpen(false);
  };

  const handleDeleteChat = (id) => {
    const next = chats.filter((chat) => chat.id !== id);

    if (next.length === 0) {
      const fresh = createChat();
      setChats([fresh]);
      setActiveChatId(fresh.id);
      return;
    }

    setChats(next);

    if (activeChatId === id) {
      setActiveChatId(next[0].id);
    }
  };

const extractAIText = (data) => {
  return (
    data?.choices?.[0]?.message?.content ||
    data?.choices?.[0]?.text ||
    data?.message?.content ||
    data?.output ||
    data?.response ||
    data?.text ||
    "No response returned from API"
  );
};


  const sendMessage = async () => {
  if (!input.trim() || !activeChat || loading) return;

  if (!API_BASE_URL || !API_KEY) {
    alert("Missing VITE_AI_BASE_URL or VITE_AI_API_KEY in .env");
    return;
  }

  const userMessage = {
    id: crypto.randomUUID(),
    role: "user",
    content: input.trim(),
  };

  const nextMessages = [...activeChat.messages, userMessage];
  updateChat(activeChat.id, nextMessages);
  setInput("");
  setLoading(true);
  setSidebarOpen(false);

  try {
    const response = await fetch(`${API_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `apikey ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        messages: nextMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        max_tokens: 3000,
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    console.log("AI response:", data);

    if (!response.ok) {
      throw new Error(
        data?.error?.message ||
        data?.error ||
        data?.message ||
        "Request failed"
      );
    }

    const aiText = extractAIText(data);

    const assistantMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: aiText,
    };

    setAnimatedMessageId(assistantMessage.id);
    updateChat(activeChat.id, [...nextMessages, assistantMessage]);
  } catch (error) {
    const errMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content:
        `Error: ${error.message}\n\n` +
        `Check these:\n` +
        `- endpoint is correct\n` +
        `- /chat/completions is appended\n` +
        `- Authorization header uses 'apikey'\n` +
        `- model name is valid\n` +
        `- CORS is allowed by provider`,
    };

    updateChat(activeChat.id, [...nextMessages, errMessage]);
  } finally {
    setLoading(false);
  }
};

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="h-screen bg-[#0b1020] text-white">
      <div className="flex h-full">
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside
          className={clsx(
            "fixed left-0 top-0 z-40 h-full w-[285px] transform border-r border-white/10 bg-[#0f172a]/95 backdrop-blur-xl transition-transform duration-300 lg:static lg:translate-x-0",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-white/10 p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-blue-500/20 p-2">
                  <Bot className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="font-semibold">AI Chat</p>
                  <p className="text-xs text-white/50">Powered by Qwen</p>
                </div>
              </div>

              <button
                onClick={() => setSidebarOpen(false)}
                className="rounded-lg p-2 hover:bg-white/10 lg:hidden"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4">
              <button
                onClick={handleNewChat}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-medium hover:bg-blue-500"
              >
                <Plus className="h-4 w-4" />
                New Chat
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 pb-4">
              <div className="space-y-2">
                {chats
                  .slice()
                  .sort((a, b) => b.updatedAt - a.updatedAt)
                  .map((chat) => (
                    <button
                      key={chat.id}
                      onClick={() => {
                        setActiveChatId(chat.id);
                        setSidebarOpen(false);
                      }}
                      className={clsx(
                        "group flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition",
                        activeChatId === chat.id
                          ? "bg-white/10 ring-1 ring-white/10"
                          : "hover:bg-white/5"
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <MessageSquare className="h-4 w-4 shrink-0 text-white/50" />
                        <span className="truncate text-sm">{chat.title}</span>
                      </div>

                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteChat(chat.id);
                        }}
                        className="opacity-0 transition group-hover:opacity-100"
                      >
                        <Trash2 className="h-4 w-4 text-white/50 hover:text-red-400" />
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-white/10 bg-white/[0.02] px-4 py-3 backdrop-blur-lg">
            <div className="flex items-center gap-3">
              <button
                className="rounded-lg p-2 hover:bg-white/10 lg:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </button>

              <div>
                <h1 className="text-sm font-semibold sm:text-base">
                  {activeChat?.title || "New Chat"}
                </h1>
                <p className="text-xs text-white/50">Qwen3-30B-A3B-SJ</p>
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
              {!activeChat?.messages?.length && (
                <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
                  <div className="mb-4 rounded-2xl bg-blue-500/10 p-4">
                    <Bot className="h-10 w-10 text-blue-400" />
                  </div>
                  <h2 className="text-3xl font-semibold">How can I help?</h2>
                  <p className="mt-2 max-w-md text-white/60">
                    Ask anything. Chats are saved in localStorage.
                  </p>
                </div>
              )}

              <div className="space-y-6">
                {activeChat?.messages?.map((msg) => (
                  <div
                    key={msg.id}
                    className={clsx(
                      "flex w-full gap-4",
                      msg.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    {msg.role === "assistant" && (
                      <div className="mt-1 hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500/20 sm:flex">
                        <Bot className="h-5 w-5 text-blue-400" />
                      </div>
                    )}

                    <div
                      className={clsx(
                        "max-w-[90%] rounded-2xl px-4 py-3 sm:max-w-[80%]",
                        msg.role === "user"
                          ? "bg-blue-600 text-white"
                          : "border border-white/10 bg-white/5 text-white"
                      )}
                    >
                      {msg.role === "assistant" ? (
                        animatedMessageId === msg.id ? (
                          <TypingMarkdown
                            content={msg.content}
                            onDone={() => setAnimatedMessageId(null)}
                          />
                        ) : (
                          <MarkdownMessage content={msg.content} />
                        )
                      ) : (
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      )}
                    </div>

                    {msg.role === "user" && (
                      <div className="mt-1 hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 sm:flex">
                        <User className="h-5 w-5 text-white/80" />
                      </div>
                    )}
                  </div>
                ))}

                {loading && (
                  <div className="flex gap-4">
                    <div className="mt-1 hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500/20 sm:flex">
                      <Bot className="h-5 w-5 text-blue-400" />
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-white/60 [animation-delay:-0.3s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-white/60 [animation-delay:-0.15s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-white/60" />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 bg-[#0b1020]/90 p-4 backdrop-blur-xl">
            <div className="mx-auto max-w-4xl">
              <div className="flex items-end gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 shadow-2xl shadow-black/20">
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Message AI..."
                  className="max-h-[180px] min-h-[24px] flex-1 resize-none bg-transparent px-2 py-2 text-white outline-none placeholder:text-white/40"
                />
                <button
                  onClick={sendMessage}
                  disabled={loading || !input.trim()}
                  className="rounded-xl bg-blue-600 p-3 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <SendHorizonal className="h-5 w-5" />
                </button>
              </div>
              <p className="mt-2 text-center text-xs text-white/40">
                Enter to send • Shift + Enter for new line
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

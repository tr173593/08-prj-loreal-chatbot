/* DOM elements */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");

/* OpenAI settings */
const apiUrl = "https://api.openai.com/v1/chat/completions";
const apiKey = window.OPENAI_API_KEY || window.openaiApiKey || "";

/* This keeps the chatbot focused on the right topic. */
const systemPrompt =
  "You are a friendly L'Oréal beauty assistant. Only answer questions related to L'Oréal products, skincare, makeup, haircare, fragrances, routines, beauty tips, and product recommendations. If the user asks about anything unrelated, politely refuse and explain that you can only help with L'Oréal and beauty-related topics. Then invite them to ask about a product, routine, or recommendation.";

/* Keep track of the conversation so replies can use earlier context. */
const conversationMemory = {
  userName: "",
  pastQuestions: [],
};

const chatHistory = [];

let currentTurnQuestion = null;

/* Build extra context for the model from the conversation history. */
function buildMemoryContext() {
  const memoryParts = [];

  if (conversationMemory.userName) {
    memoryParts.push(`The user's name is ${conversationMemory.userName}.`);
  }

  if (conversationMemory.pastQuestions.length > 0) {
    memoryParts.push(
      `Past user questions: ${conversationMemory.pastQuestions.join(" | ")}`,
    );
  }

  return memoryParts.join(" ");
}

/* Build the full message list for OpenAI. */
function buildMessages(userMessage) {
  const messages = [
    {
      role: "system",
      content: systemPrompt,
    },
  ];

  const memoryContext = buildMemoryContext();

  if (memoryContext) {
    messages.push({
      role: "system",
      content: `Conversation memory: ${memoryContext}`,
    });
  }

  messages.push(...chatHistory);

  messages.push({
    role: "user",
    content: userMessage,
  });

  return messages;
}

/* Try to capture a user's name from their message. */
function updateMemoryFromMessage(userMessage) {
  const namePatterns = [
    /(?:my name is|i am|i'm|im)\s+([A-Za-zÀ-ÿ'’-]{2,})/i,
    /call me\s+([A-Za-zÀ-ÿ'’-]{2,})/i,
  ];

  for (const pattern of namePatterns) {
    const match = userMessage.match(pattern);

    if (match && match[1]) {
      conversationMemory.userName = match[1].replace(/[.,!?]$/, "");
      break;
    }
  }

  conversationMemory.pastQuestions.push(userMessage);

  if (conversationMemory.pastQuestions.length > 10) {
    conversationMemory.pastQuestions.shift();
  }
}

/* Add a message bubble to the chat window. */
function addMessage(text, className) {
  const messageElement = document.createElement("div");
  messageElement.className = `msg ${className}`;
  messageElement.textContent = text;
  chatWindow.appendChild(messageElement);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return messageElement;
}

/* Start a new conversation turn with the user's latest question. */
function startConversationTurn(userMessage) {
  currentTurnQuestion = document.createElement("div");
  currentTurnQuestion.className = "turn";

  const questionLabel = document.createElement("div");
  questionLabel.className = "turn-label turn-label-user";
  questionLabel.textContent = "Your question";

  const questionText = document.createElement("div");
  questionText.className = "turn-question";
  questionText.textContent = userMessage;

  currentTurnQuestion.appendChild(questionLabel);
  currentTurnQuestion.appendChild(questionText);
  chatWindow.appendChild(currentTurnQuestion);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return currentTurnQuestion;
}

/* Add or replace the assistant response for the current turn. */
function setTurnResponse(text) {
  if (!currentTurnQuestion) {
    return;
  }

  let responseElement = currentTurnQuestion.querySelector(".turn-response");

  if (!responseElement) {
    const responseLabel = document.createElement("div");
    responseLabel.className = "turn-label turn-label-assistant";
    responseLabel.textContent = "Assistant";

    responseElement = document.createElement("div");
    responseElement.className = "turn-response msg ai";

    currentTurnQuestion.appendChild(responseLabel);
    currentTurnQuestion.appendChild(responseElement);
  }

  responseElement.textContent = text;
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return responseElement;
}

/* Show the first greeting message. */
addMessage(
  "Hello. Ask me about L'Oréal products, routines, or recommendations.",
  "ai",
);

/* Send the user's message to OpenAI and show the reply. */
async function sendMessage(userMessage) {
  if (!apiKey) {
    setTurnResponse(
      "The OpenAI API key is missing. Add it in secrets.js as window.OPENAI_API_KEY.",
    );
    return;
  }

  setTurnResponse("Thinking…");

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: buildMessages(userMessage),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMessage = data?.error?.message || "Something went wrong.";
      setTurnResponse(`Sorry, I could not get a response. ${errorMessage}`);
      return;
    }

    const reply = data?.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      setTurnResponse("Sorry, I could not generate a reply just now.");
      return;
    }

    chatHistory.push({
      role: "user",
      content: userMessage,
    });

    chatHistory.push({
      role: "assistant",
      content: reply,
    });

    setTurnResponse(reply);
  } catch (error) {
    setTurnResponse("There was a network problem. Please try again.");
  }
}

/* Handle form submit */
chatForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const userMessage = userInput.value.trim();

  if (!userMessage) {
    return;
  }

  updateMemoryFromMessage(userMessage);
  startConversationTurn(userMessage);
  userInput.value = "";
  userInput.focus();

  sendMessage(userMessage);
});

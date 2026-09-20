import "dotenv/config";

import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import { MemorySaver } from "@langchain/langgraph";
import { basicModel } from "./agents/main";
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
} from "@langchain/core/messages";
import "dotenv/config";

// 1. 创建组件
const memory = new MemorySaver();
const llm = basicModel;

// 2. 定义状态
const ChatbotState = Annotation.Root({
  messages: Annotation({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
});

// 3. 定义聊天节点
async function chatNode(state: any) {
  // 添加系统提示（让 AI 知道要记住上下文）
  const systemPrompt = new SystemMessage(
    "你是一个友好的助手。请记住用户在对话中提到的信息（如名字、偏好等），" +
      "并在后续对话中自然地使用这些信息。保持对话连贯性。"
  );

  // 组合消息：系统提示 + 历史消息
  const messagesWithSystem = [systemPrompt, ...state.messages];

  const response = await llm.invoke(messagesWithSystem);
  return { messages: [response] };
}

// 4. 构建图
const chatbot = new StateGraph(ChatbotState)
  .addNode("chat", chatNode)
  .addEdge(START, "chat")
  .addEdge("chat", END)
  .compile({ checkpointer: memory });

// 5. 对话函数
async function chat(threadId: string,   userMessage: string) {
  const config = { configurable: { thread_id: threadId } };

  const result = await chatbot.invoke(
    { messages: [new HumanMessage(userMessage)] },
    config
  );

  // 获取最后一条 AI 回复
  const aiResponse = result.messages[result.messages.length - 1];
  return aiResponse.content;
}

// 6. 测试多轮对话
async function main() {
  const threadId = "demo_conversation";

  console.log("🤖 开始多轮对话演示\n");
  console.log("=".repeat(50));

  // 第一轮
  console.log("👤 用户: 你好，我叫小明");
  let response = await chat(threadId, "你好，我叫小明");
  console.log(`🤖 AI: ${response}\n`);

  // 第二轮
  console.log("👤 用户: 我喜欢编程，特别是 JavaScript");
  response = await chat(threadId, "我喜欢编程，特别是 JavaScript");
  console.log(`🤖 AI: ${response}\n`);

  // 第三轮（测试记忆）
  console.log("👤 用户: 我叫什么名字？我喜欢什么？");
  response = await chat(threadId, "我叫什么名字？我喜欢什么？");
  console.log(`🤖 AI: ${response}\n`);

  console.log("=".repeat(50));
  console.log("✅ 演示完成！AI 成功记住了用户信息！");
}

main();

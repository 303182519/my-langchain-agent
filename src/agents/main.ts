import { createAgent } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { getWeather } from "../tools/weather";

export const model = new ChatOpenAI({
	model: "qwen3.8-27b",
	apiKey: process.env.QIANWEN_API_KEY,
	configuration: {
		baseURL: process.env.QWEN_API_URL,
	},
	temperature: 0.3, // 值越高，输出越有创造性但也越不可控
	maxTokens: 2048, // 最大输出长度
	timeout: 30000, // 超时时间（毫秒）
	maxRetries: 3, // 失败自动重试次数
});

export const agent = createAgent({
	model,
	tools: [getWeather],
	systemPrompt: "你是智能助手，可以调用工具完成用户问题。工具返回结果后整理成自然中文回答",
});

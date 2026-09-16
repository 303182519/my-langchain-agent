import { createAgent } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { getWeather } from "../tools/weather";

const model = new ChatOpenAI({
	model: "qwen3.8-27b",
	apiKey: process.env.QIANWEN_API_KEY,
	configuration: {
		baseURL: process.env.QWEN_API_URL,
	},
	temperature: 0.3,
});

export const agent = createAgent({
	model,
	tools: [getWeather],
	systemPrompt: "你是智能助手，可以调用工具完成用户问题。工具返回结果后整理成自然中文回答",
});

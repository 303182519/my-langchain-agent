import { createAgent, createMiddleware } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { getWeather } from "../tools/weather";

export const basicModel = new ChatOpenAI({
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


export const advancedModel = new ChatOpenAI({
	model: "qwen3.7-flash-2026-07-15",
	apiKey: process.env.QIANWEN_API_KEY,
	configuration: {
		baseURL: process.env.QWEN_API_URL,
	},
	temperature: 0.3, // 值越高，输出越有创造性但也越不可控
	maxTokens: 2048, // 最大输出长度
	timeout: 30000, // 超时时间（毫秒）
	maxRetries: 3, // 失败自动重试次数
});


// 创建动态模型选择中间件
export const dynamicModelMiddleware = createMiddleware({
  name: "DynamicModelSelection",
  
  // 拦截模型调用请求
  wrapModelCall: (request, handler) => {
    const messageCount = request.messages.length;
    
    // 超过 10 条消息时，认为任务较复杂，切换到高级模型
    const selectedModel = messageCount > 10 ? advancedModel : basicModel;
    
    console.log(`选择模型: ${selectedModel.model} (消息数: ${messageCount})`);
    
    // 用选中的模型处理请求
    return handler({ ...request, model: selectedModel });
  },
});

export const agent = createAgent({
	model: basicModel,
	tools: [getWeather],
	middleware: [dynamicModelMiddleware],
});

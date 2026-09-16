import "dotenv/config";

import { createAgent, toolStrategy } from "langchain";
import { basicModel, dynamicModelMiddleware } from "./agents/main";
import { getWeather } from "./tools/weather";


import { z } from "zod";

// 定义联系人 Schema
const ContactSchema = z.object({
  contacts: z.array(
    z.object({
      name: z.string().describe("姓名"),
      email: z.string().email().optional().describe("邮箱，如果有的话"),
      phone: z.string().optional().describe("电话号码，如果有的话"),
      company: z.string().optional().describe("公司名称，如果有的话"),
    })
  ).describe("提取出的联系人列表"),
});


const extractorAgent = createAgent({
  model: basicModel,
  tools: [getWeather],
  middleware: [dynamicModelMiddleware],
  responseFormat: toolStrategy(ContactSchema),
});

const text = `
  本次会议参与者：
  张三（zhangsan@example.com，18800001111，来自 ABC 科技）
  李四（lisi@company.com，来自 XYZ 集团）
  王五（13900002222）
`;

const result = await extractorAgent.invoke({
  messages: [
    { role: "user", content: `从以下文本中提取联系人信息：\n${text}` },
  ],
});

console.log(result.structuredResponse.contacts);


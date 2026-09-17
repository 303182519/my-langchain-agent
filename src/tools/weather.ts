
import { tool } from "langchain";
import { z } from "zod";

// 第三步：定义天气查询工具
export const getWeather = tool(
  async ({ city }) => `${city} 今日天气：晴，气温 22°C，湿度 60%`,
  {
    name: "get_weather",
    description: "查询指定城市的当前天气",
    schema: z.object({
      city: z.string().describe("要查询天气的城市名称"),
    }),
  }
);
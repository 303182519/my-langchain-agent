import { createServer } from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

const server = new McpServer({
  name: 'my-http-mcp-server',
  version: '1.0.0',
});

const users = {
  '001': { id: '001', name: '张三', email: 'zhangsan@example.com', role: 'admin' },
  '002': { id: '002', name: '李四', email: 'lisi@example.com', role: 'user' },
  '003': { id: '003', name: '王五', email: 'wangwu@example.com', role: 'user' },
};

server.registerTool(
  'query_user',
  {
    description: '根据用户 ID 查询用户信息。',
    inputSchema: {
      userId: z.string().describe('用户 ID，例如：001、002、003'),
    },
  },
  async ({ userId }) => {
    const user = users[userId];
    return {
      content: [
        {
          type: 'text',
          text: user
            ? `ID: ${user.id}\n姓名: ${user.name}\n邮箱: ${user.email}\n角色: ${user.role}`
            : `找不到用户 ${userId}。可用 ID：001、002、003`,
        },
      ],
    };
  },
);

server.registerResource(
  '使用指南',
  'docs://guide',
  {
    description: 'HTTP MCP 示例服务的使用指南。',
    mimeType: 'text/plain',
  },
  async () => ({
    contents: [
      {
        uri: 'docs://guide',
        mimeType: 'text/plain',
        text: '这是一个通过 Streamable HTTP 提供服务的 MCP Server 示例。',
      },
    ],
  }),
);

const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: undefined,
});

await server.connect(transport);

const host = process.env.MCP_HOST ?? '127.0.0.1';
const port = Number(process.env.MCP_PORT ?? 3001);
const httpServer = createServer(async (req, res) => {
  const pathname = (req.url ?? '/').split('?')[0];
  if (pathname !== '/mcp') {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  if (!['GET', 'POST', 'DELETE'].includes(req.method ?? '')) {
    res.writeHead(405, { Allow: 'GET, POST, DELETE' });
    res.end();
    return;
  }

  try {
    await transport.handleRequest(req, res);
  } catch (error) {
    console.error('处理 MCP HTTP 请求失败:', error);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Internal Server Error');
    } else {
      res.destroy(error);
    }
  }
});

httpServer.listen(port, host, () => {
  console.log(`HTTP MCP Server listening at http://${host}:${port}/mcp`);
});

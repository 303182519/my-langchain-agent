import fs from "node:fs/promises";


async function readFile(filePath) {
    const content = await fs.readFile(filePath, "utf-8");
    console.log(content)
}

readFile("./src/02/hello-langchain.mjs");

// 命令运行在pkg.json的根目录下运行 node src/02/test.mjs 
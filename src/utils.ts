const fs = require('fs');

export function generateRandomString(length) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        result += characters.charAt(randomIndex);
    }

    return result;
}


export function deleteFolderRecursive(folderPath) {
    if (fs.existsSync(folderPath)) {
      fs.readdirSync(folderPath).forEach((file) => {
        const filePath = `${folderPath}/${file}`;
  
        if (fs.lstatSync(filePath).isDirectory()) {
          // 递归删除子目录
          deleteFolderRecursive(filePath);
        } else {
          // 删除文件
          fs.unlinkSync(filePath);
          console.log(`${filePath} 删除成功`);
        }
      });
  
      // 删除空目录
      fs.rmdirSync(folderPath);
      console.log(`${folderPath} 删除成功`);
    }
  }
  

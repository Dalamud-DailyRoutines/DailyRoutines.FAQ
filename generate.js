const fs = require('fs');
const path = require('path');
const glob = require('glob');
const frontmatter = require('front-matter');

const articlesDir = path.join(__dirname, 'articles');
const outputFile = path.join(__dirname, 'articles.json');

function generateIndex() {
    // 确保文章目录存在
    if (!fs.existsSync(articlesDir)) {
        fs.mkdirSync(articlesDir, { recursive: true });
    }

    const categories = [];
    
    // 获取所有子文件夹作为分类
    const categoryDirs = glob.sync('articles/*/', { onlyDirectories: true });
    
    categoryDirs.forEach(categoryDir => {
        const categoryName = path.basename(categoryDir);
        const articles = [];
        
        // 获取分类目录下的文章
        const articleFiles = glob.sync(`${categoryDir}/**/*.md`);
        
        articleFiles.forEach(file => {
            try {
                const content = fs.readFileSync(file, 'utf8');
                const { attributes, body } = frontmatter(content);
                
                // 验证必需的 frontmatter 字段
                if (!attributes.title) {
                    console.warn(`警告: ${file} 缺少标题字段`);
                    return;
                }

                // 获取文件的最后修改时间
                const stats = fs.statSync(file);
                const lastModified = stats.mtime;
                const date = lastModified.toISOString().split('T')[0];

                const article = {
                    title: attributes.title,
                    date: date,
                    slug: path.basename(file, '.md'),
                    description: attributes.description || '',
                    tags: attributes.tags || [],
                    lastModified: lastModified.toISOString()
                };

                articles.push(article);
            } catch (error) {
                console.error(`处理文件 ${file} 时出错:`, error);
            }
        });

        // 按日期降序排序文章
        const sortedArticles = articles.sort((a, b) => 
            new Date(b.date) - new Date(a.date)
        );

        categories.push({
            name: categoryName,
            articles: sortedArticles
        });
    });

    // 按分类名称排序
    categories.sort((a, b) => a.name.localeCompare(b.name));

    // 写入 JSON 文件
    try {
        fs.writeFileSync(outputFile, JSON.stringify(categories, null, 2));
        console.log('✅ 索引生成成功！');
        console.log(`📚 共处理 ${categories.length} 个分类，${categories.reduce((sum, cat) => sum + cat.articles.length, 0)} 篇文章`);
    } catch (error) {
        console.error('❌ 写入索引文件失败:', error);
        process.exit(1);
    }
}

// 执行生成
generateIndex(); 
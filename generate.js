const fs = require('fs');
const path = require('path');
const glob = require('glob');
const frontmatter = require('front-matter');
const { LANGUAGE_CONFIG } = require('./js/config.js');

const articlesDir = path.join(__dirname, 'articles');
const outputFile = path.join(__dirname, 'articles.json');

function getArticleLanguage(filename) {
    const match = filename.match(/\.([a-z]{2})\.md$/);
    return match ? match[1] : LANGUAGE_CONFIG.default;
}

function getBaseSlug(filename) {
    return filename.replace(/\.[a-z]{2}\.md$/, '.md').replace(/\.md$/, '');
}

function generateIndex() {
    // 确保文章目录存在
    if (!fs.existsSync(articlesDir)) {
        fs.mkdirSync(articlesDir, { recursive: true });
    }

    const categories = [];
    const articlesBySlug = new Map(); // 用于存储所有语言版本的文章
    
    // 获取所有子文件夹作为分类
    const categoryDirs = glob.sync('articles/*/', { onlyDirectories: true });
    
    categoryDirs.forEach(categoryDir => {
        const categoryName = path.basename(categoryDir);
        const articles = new Map(); // 用于存储该分类下的文章
        
        // 获取分类目录下的所有文章
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

                const language = getArticleLanguage(path.basename(file));
                const baseSlug = getBaseSlug(path.basename(file));

                const article = {
                    title: attributes.title,
                    date: date,
                    slug: baseSlug,
                    description: attributes.description || '',
                    tags: attributes.tags || [],
                    lastModified: lastModified.toISOString(),
                    language: language,
                    translations: {}
                };

                if (!articles.has(baseSlug)) {
                    articles.set(baseSlug, {
                        base: null,
                        translations: {}
                    });
                }

                const articleData = articles.get(baseSlug);
                if (language === LANGUAGE_CONFIG.default) {
                    articleData.base = article;
                } else {
                    articleData.translations[language] = article;
                }
            } catch (error) {
                console.error(`处理文件 ${file} 时出错:`, error);
            }
        });

        // 处理文章的翻译信息并创建最终的文章列表
        const finalArticles = [];
        articles.forEach((articleData, slug) => {
            if (articleData.base) {
                const finalArticle = { ...articleData.base };
                finalArticle.translations = articleData.translations;
                finalArticles.push(finalArticle);
            }
        });

        // 按日期降序排序文章
        const sortedArticles = finalArticles.sort((a, b) => 
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
        fs.writeFileSync(outputFile, JSON.stringify({
            languages: LANGUAGE_CONFIG,
            categories: categories
        }, null, 2));
        console.log('✅ 索引生成成功！');
        console.log(`📚 共处理 ${categories.length} 个分类，${categories.reduce((sum, cat) => sum + cat.articles.length, 0)} 篇文章`);
    } catch (error) {
        console.error('❌ 写入索引文件失败:', error);
        process.exit(1);
    }
}

// 执行生成
generateIndex(); 
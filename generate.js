const fs = require('fs');
const path = require('path');
const glob = require('glob');
const frontmatter = require('front-matter');
const { LANGUAGE_CONFIG, CATEGORY_WEIGHTS } = require('./js/config.js');

const articlesDir = path.join(__dirname, 'articles');
const outputFile = path.join(__dirname, 'articles.json');

// 存储现有文章的日期和最后修改时间
let existingArticlesData = {};
try {
    if (fs.existsSync(outputFile)) {
        const existingData = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
        existingData.categories.forEach(category => {
            category.articles.forEach(article => {
                existingArticlesData[`${category.name}/${article.slug}`] = {
                    date: article.date,
                    lastModified: article.lastModified
                };
                
                // 处理翻译
                Object.keys(article.translations).forEach(lang => {
                    const translation = article.translations[lang];
                    existingArticlesData[`${category.name}/${translation.slug}/${lang}`] = {
                        date: translation.date,
                        lastModified: translation.lastModified
                    };
                });
            });
        });
    }
} catch (error) {
    console.warn('无法读取现有文章数据，将为所有文章生成新的日期:', error);
}

function getArticleLanguage(filename) {
    const match = filename.match(/\.([a-z]{2})\.md$/);
    return match ? match[1] : LANGUAGE_CONFIG.default;
}

function getBaseSlug(filename) {
    return filename.replace(/\.[a-z]{2}\.md$/, '.md').replace(/\.md$/, '');
}

function generateIndex() {
    console.log('===== 开始生成索引 =====');
    
    // 输出现有文章数据的数量
    console.log(`已加载 ${Object.keys(existingArticlesData).length} 篇现有文章的数据`);
    
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

                const language = getArticleLanguage(path.basename(file));
                const baseSlug = getBaseSlug(path.basename(file));
                
                // 获取文件的当前最后修改时间
                const stats = fs.statSync(file);
                const currentLastModified = stats.mtime.toISOString();
                
                // 尝试从现有数据中获取日期和最后修改时间
                const articleKey = `${categoryName}/${baseSlug}${language !== LANGUAGE_CONFIG.default ? `/${language}` : ''}`;
                const existingData = existingArticlesData[articleKey];
                
                let date, lastModified;
                
                if (existingData) {
                    // 检查文件是否已被修改
                    if (new Date(existingData.lastModified).getTime() !== new Date(currentLastModified).getTime()) {
                        // 文件已修改，更新日期和最后修改时间
                        date = currentLastModified.split('T')[0];
                        lastModified = currentLastModified;
                        console.log(`文件已修改: ${file}, 新日期: ${date}`);
                    } else {
                        // 文件未修改，保留原有日期和最后修改时间
                        date = existingData.date;
                        lastModified = existingData.lastModified;
                        console.log(`文件未修改: ${file}, 保留日期: ${date}`);
                    }
                } else {
                    // 新文件，使用当前日期和最后修改时间
                    date = currentLastModified.split('T')[0];
                    lastModified = currentLastModified;
                    console.log(`新文件: ${file}, 日期: ${date}`);
                }

                const article = {
                    title: attributes.title,
                    date: date,
                    slug: baseSlug,
                    description: attributes.description || '',
                    tags: attributes.tags || [],
                    lastModified: lastModified,
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

    // 按分类权重排序，权重相同时按名称排序
    categories.sort((a, b) => {
        const weightA = CATEGORY_WEIGHTS[a.name] || 0;
        const weightB = CATEGORY_WEIGHTS[b.name] || 0;
        if (weightA === weightB) {
            return a.name.localeCompare(b.name);
        }
        return weightB - weightA;
    });

    // 写入 JSON 文件
    try {
        fs.writeFileSync(outputFile, JSON.stringify({
            config: LANGUAGE_CONFIG,
            categoryWeights: CATEGORY_WEIGHTS, // 添加权重配置到输出
            categories: categories
        }, null, 2));
        console.log('✅ 索引生成成功！');
        console.log(`📚 共处理 ${categories.length} 个分类，${categories.reduce((sum, cat) => sum + cat.articles.length, 0)} 篇文章`);
        console.log('===== 索引生成完成 =====');
    } catch (error) {
        console.error('❌ 写入索引文件失败:', error);
        process.exit(1);
    }
}

// 执行生成
generateIndex(); 
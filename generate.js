const fs = require('fs');
const path = require('path');
const glob = require('glob');
const frontmatter = require('front-matter');
const { execSync } = require('child_process');
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

// 获取文件的 Git 最后修改时间
function getGitLastModifiedDate(filePath) {
    try {
        // 获取文件最后修改的 Git 提交日期
        const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
        const lastModified = execSync(`git log -1 --format="%aI" -- "${relativePath}"`, { encoding: 'utf8' }).trim();
        
        if (lastModified) {
            return lastModified;
        }
    } catch (error) {
        console.warn(`获取文件 ${filePath} 的 Git 修改时间失败:`, error.message);
    }
    
    // 如果 Git 命令失败或文件没有 Git 历史，返回文件系统的修改时间
    const stats = fs.statSync(filePath);
    return stats.mtime.toISOString();
}

// 检查文件是否在 Git 中是新文件
function isNewGitFile(filePath) {
    try {
        const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
        // 检查文件是否有 Git 提交历史
        const gitHistory = execSync(`git log --format="%H" -- "${relativePath}"`, { encoding: 'utf8' }).trim();
        return !gitHistory;
    } catch (error) {
        // 如果出错，假设文件是新的
        return true;
    }
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
                
                // 使用 Git 获取文件的最后修改时间
                const currentLastModified = getGitLastModifiedDate(file);
                const isNewFile = isNewGitFile(file);
                
                // 尝试从现有数据中获取日期和最后修改时间
                const articleKey = `${categoryName}/${baseSlug}${language !== LANGUAGE_CONFIG.default ? `/${language}` : ''}`;
                const existingData = existingArticlesData[articleKey];
                
                let date, lastModified;
                
                if (existingData && !isNewFile) {
                    // 比较 Git 最后修改时间与现有记录的最后修改时间
                    if (new Date(existingData.lastModified).getTime() !== new Date(currentLastModified).getTime()) {
                        // 文件已修改，更新日期和最后修改时间
                        // 保留原始创建日期，仅更新最后修改时间
                        date = existingData.date;
                        lastModified = currentLastModified;
                        console.log(`文件已修改: ${file}, 保留创建日期: ${date}, 更新修改时间: ${lastModified}`);
                    } else {
                        // 文件未修改，保留原有日期和最后修改时间
                        date = existingData.date;
                        lastModified = existingData.lastModified;
                        console.log(`文件未修改: ${file}, 保留日期: ${date}`);
                    }
                } else {
                    // 新文件，使用当前日期和最后修改时间
                    // 对于新文件，创建日期和修改日期相同
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
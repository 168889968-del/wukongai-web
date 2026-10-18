import {
  FileText,
  GitBranch,
  GraduationCap,
  Image,
  PanelsTopLeft,
  Presentation,
  type LucideIcon,
} from 'lucide-react'

export type SkillCategoryId =
  | 'presentations'
  | 'documents'
  | 'images'
  | 'research'
  | 'browser'
  | 'development'

export type SkillItem = {
  id: string
  title: string
  category: SkillCategoryId
  icon: LucideIcon
  description: string
  example: string
}

export type SkillMetadata = {
  kind: 'Skill' | 'MCP'
  duration: string
  recommended?: boolean
  requirement?: string
  sourceUrl?: string
  previewUrl?: string
}

export const skillCategories: { id: 'all' | SkillCategoryId; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'presentations', label: '演示文稿' },
  { id: 'documents', label: '文档' },
  { id: 'images', label: '图像与封面' },
  { id: 'research', label: '研究' },
  { id: 'browser', label: '浏览器' },
  { id: 'development', label: '开发' },
]

export const skills: SkillItem[] = [
  {
    id: 'gpt-image-2', title: '让 Codex 使用 GPT Image 2 生图', category: 'images', icon: Image,
    description: '配置图像模型后，完成文字生图、参考图编辑、换背景和局部修改。',
    example: '用 GPT Image 2 按我的描述生成一张图片，并根据参考图继续修改。',
  },
  {
    id: 'editable-deck', title: '把文档直接变成能改的 PPT', category: 'presentations', icon: Presentation,
    description: '把 PDF、Word、Markdown 或主题整理成可编辑的演示文稿，文字、图表和表格都能继续修改。',
    example: '把这份资料整理成一套结构清楚、元素可编辑的 PPT。',
  },
  {
    id: 'polished-deck', title: '让 Codex 做一份好看的演示文稿', category: 'presentations', icon: Presentation,
    description: '先规划内容大纲，再生成完整幻灯片、配图和演讲者备注。',
    example: '根据这份材料做一套适合汇报的演示文稿，并附上演讲备注。',
  },
  {
    id: 'rescue-deck', title: '把图片版 PPT 救成可编辑文档', category: 'presentations', icon: Presentation,
    description: '参考幻灯片截图或 PDF 重建页面布局，让关键内容重新成为可编辑元素。',
    example: '参考这些幻灯片截图，重建成布局相近、内容可编辑的 PPT。',
  },
  {
    id: 'web-presentation', title: '制作网页演示文稿', category: 'presentations', icon: PanelsTopLeft,
    description: '生成可在浏览器演示的 HTML 幻灯片，并提供演讲者视图、备注和计时器。',
    example: '把这个提纲制作成网页演示稿，带演讲者备注和计时器。',
  },
  {
    id: 'deck-craft', title: '教 Codex 制作和修改 PPT', category: 'presentations', icon: Presentation,
    description: '创建或编辑 PowerPoint 文件，保留可单独选择的文字和图形对象。',
    example: '用这个模板制作 PPT，并把标题、图表和正文保留为可编辑对象。',
  },
  {
    id: 'word-docs', title: '让 Codex 会写 Word', category: 'documents', icon: FileText,
    description: '生成包含标题层级、目录、表格和页眉页脚的 .docx 文档。',
    example: '把这份方案整理成格式规范的 Word 文档，带目录和表格。',
  },
  {
    id: 'excel-workbook', title: '让 Codex 处理 Excel', category: 'documents', icon: FileText,
    description: '读写 .xlsx 工作簿，协助处理公式、图表和数据透视表。',
    example: '检查这份工作簿，补齐公式并生成按月份汇总的图表。',
  },
  {
    id: 'read-files', title: '让 Codex 读取各种文件', category: 'documents', icon: FileText,
    description: '把 PDF、Word、Excel、PPT、音频和网页等资料整理成可用文本。',
    example: '读取这些文件，提取重点并按主题整理成一份摘要。',
  },
  {
    id: 'status-report', title: '让 Codex 写工作汇报', category: 'documents', icon: FileText,
    description: '用周报、项目状态和复盘模板，把进展整理成清楚的汇报。',
    example: '根据本周记录生成一份包含进展、风险和下周安排的周报。',
  },
  {
    id: 'thesis', title: '让 Codex 陪你写学位论文', category: 'research', icon: GraduationCap,
    description: '按阶段处理提纲、章节结构、参考文献、润色、缩写扩写和翻译。',
    example: '先检查我的论文大纲，标出逻辑问题并给出逐章修改计划。',
  },
  {
    id: 'image-creation', title: '让 Codex 按描述生成图片', category: 'images', icon: Image,
    description: '根据简短描述创建图片，也可结合参考图继续创作。',
    example: '根据这段描述生成一张简洁的产品插画。',
  },
  {
    id: 'social-covers', title: '制作社交媒体配图和封面', category: 'images', icon: Image,
    description: '为小红书、微信等内容制作封面和卡片，提供多种版式与主题。',
    example: '把这段活动介绍做成适合小红书发布的封面和配图。',
  },
  {
    id: 'diagrams', title: '教 Codex 绘制流程图', category: 'images', icon: PanelsTopLeft,
    description: '把流程、架构、UML 和教学示意内容整理成可编辑图表。',
    example: '把这个业务流程整理成结构清晰的流程图。',
  },
  {
    id: 'translation', title: '让 Codex 帮你翻译', category: 'images', icon: FileText,
    description: '按快速、常规或精细模式翻译内容，也可以使用自定义术语表。',
    example: '按精细模式翻译这段材料，并按术语表统一专业词汇。',
  },
  {
    id: 'find-papers', title: '教 Codex 查找论文', category: 'research', icon: GraduationCap,
    description: '从多个学术来源检索资料，并按来源整理搜索结果。',
    example: '围绕这个主题查找近期论文，列出标题、来源和摘要。',
  },
  {
    id: 'zotero', title: '让 Codex 连接 Zotero', category: 'research', icon: GraduationCap,
    description: '根据 Zotero 中保存的参考资料整理文献和书目。',
    example: '根据我保存的文献，按主题整理研究脉络和参考书目。',
  },
  {
    id: 'trials-genes', title: '检索临床试验和基因资料', category: 'research', icon: GraduationCap,
    description: '检索 ClinicalTrials、ClinVar、gnomAD、PubMed 等生物医学资料来源。',
    example: '查找与这个基因相关的临床试验和公开研究资料。',
  },
  {
    id: 'academic-suite', title: 'ARS 学术研究套件', category: 'research', icon: GraduationCap,
    description: '覆盖文献调研、论文写作和综述整理的研究流程。',
    example: '按主题制定文献调研计划，归纳研究问题和待验证观点。',
  },
  {
    id: 'browser', title: '让 Codex 操作浏览器', category: 'browser', icon: PanelsTopLeft,
    description: '协助查找信息、批量下载附件、保存网页为 PDF 和重复填写表单。',
    example: '打开这些网页，提取指定信息并整理成表格。',
  },
  {
    id: 'github', title: '让 Codex 连接 GitHub', category: 'development', icon: GitBranch,
    description: '搜索仓库、查看 Issue 和 PR、关注项目，并协助仓库协作。',
    example: '检查这个仓库最近的 Issue 和 PR，汇总需要处理的事项。',
  },
]

// Public catalog details are kept separate from the card copy so the detail
// panel can show requirements and original project links without crowding the grid.
export const skillMetadata: Record<string, SkillMetadata> = {
  'gpt-image-2': { kind: 'Skill', duration: '2–5 分钟', recommended: true, requirement: '需要 Python 3.10 或更新版本。' },
  'editable-deck': { kind: 'Skill', duration: '8–20 分钟', recommended: true, requirement: '需要 Python 3.10 或更新版本。', sourceUrl: 'https://github.com/hugohe3/ppt-master', previewUrl: 'https://hugohe3.github.io/ppt-master-examples/' },
  'polished-deck': { kind: 'Skill', duration: '8–20 分钟', recommended: true, requirement: '需要 Python 3.10 或更新版本。', sourceUrl: 'https://github.com/ningzimu/codex-ppt-skill', previewUrl: 'https://github.com/ningzimu/codex-ppt-skill#生成效果' },
  'rescue-deck': { kind: 'Skill', duration: '6–15 分钟', recommended: true, requirement: '需要 Python 3.10 或更新版本。', sourceUrl: 'https://github.com/ningzimu/image-to-editable-ppt-skill', previewUrl: 'https://github.com/ningzimu/image-to-editable-ppt-skill#转换效果示例' },
  'web-presentation': { kind: 'Skill', duration: '3–8 分钟', requirement: '生成 HTML 演示文稿；本地验证需要 Node.js。' },
  'deck-craft': { kind: 'MCP', duration: '5–12 分钟', requirement: '使用 Python uv 工具。', sourceUrl: 'https://github.com/GongRzhe/Office-PowerPoint-MCP-Server' },
  'word-docs': { kind: 'MCP', duration: '5–12 分钟', requirement: '使用 Python uv 工具。', sourceUrl: 'https://github.com/GongRzhe/Office-Word-MCP-Server' },
  'excel-workbook': { kind: 'MCP', duration: '5–12 分钟', requirement: '使用 Python uv 工具。', sourceUrl: 'https://github.com/haris-musa/excel-mcp-server' },
  'read-files': { kind: 'MCP', duration: '2–6 分钟', requirement: '使用 Python uv 工具。', sourceUrl: 'https://github.com/microsoft/markitdown/tree/57a481e1aa7a45f164ed041f9f5bace1ecfd23f2/packages/markitdown-mcp' },
  'status-report': { kind: 'Skill', duration: '2–5 分钟', recommended: true, requirement: '仅包含操作说明，无需安装外部服务。', sourceUrl: 'https://github.com/xstongxue/best-skills/tree/88a38bb6443ae29d0b2c6849c80b4d78fbb9b21a/skills/md-report-summary' },
  thesis: { kind: 'Skill', duration: '2–6 分钟', recommended: true, requirement: '仅包含操作说明，无需安装外部服务。', sourceUrl: 'https://github.com/xstongxue/best-skills/tree/88a38bb6443ae29d0b2c6849c80b4d78fbb9b21a/skills/paper-write' },
  'image-creation': { kind: 'Skill', duration: '2–6 分钟', requirement: '本地模式需要 Node.js。', sourceUrl: 'https://github.com/JimLiu/baoyu-skills/tree/1567581c26ec29f4216c6e6835415bf30343b0e3/skills/baoyu-image-gen' },
  'social-covers': { kind: 'Skill', duration: '6–18 分钟', requirement: '本地模式需要 Node.js。', sourceUrl: 'https://github.com/op7418/guizang-social-card-skill' },
  diagrams: { kind: 'Skill', duration: '6–18 分钟', recommended: true, requirement: '输出 Draw.io 源文件，可继续编辑。', sourceUrl: 'https://github.com/xstongxue/best-skills/tree/88a38bb6443ae29d0b2c6849c80b4d78fbb9b21a/skills/drawio-diagram', previewUrl: 'https://github.com/xstongxue/best-skills#效果预览' },
  translation: { kind: 'Skill', duration: '8–18 分钟', requirement: '本地模式需要 Node.js。', sourceUrl: 'https://github.com/JimLiu/baoyu-skills/tree/1567581c26ec29f4216c6e6835415bf30343b0e3/skills/baoyu-translate' },
  'find-papers': { kind: 'MCP', duration: '6–20 分钟', requirement: '使用 Python uv 工具。', sourceUrl: 'https://github.com/openags/paper-search-mcp' },
  zotero: { kind: 'MCP', duration: '6–20 分钟', requirement: '使用 Python uv 工具。', sourceUrl: 'https://github.com/54yyyu/zotero-mcp' },
  'trials-genes': { kind: 'MCP', duration: '5–12 分钟', requirement: '使用 Python uv 工具；多数查询无需 API 密钥。', sourceUrl: 'https://github.com/genomoncology/biomcp' },
  'academic-suite': { kind: 'Skill', duration: '6–20 分钟', recommended: true, requirement: '需要 Python 3.10 或更新版本。', sourceUrl: 'https://github.com/Imbad0202/academic-research-skills-codex', previewUrl: 'https://github.com/Imbad0202/academic-research-skills-codex/tree/main/examples' },
  browser: { kind: 'MCP', duration: '5–12 分钟', recommended: true, requirement: '本地模式需要 Node.js。', sourceUrl: 'https://github.com/microsoft/playwright-mcp' },
  github: { kind: 'MCP', duration: '5–12 分钟', requirement: '需要 GitHub 账号授权。', sourceUrl: 'https://github.com/github/github-mcp-server' },
}

export const categoryLabel = (id: SkillCategoryId) =>
  skillCategories.find((category) => category.id === id)?.label ?? '技能'

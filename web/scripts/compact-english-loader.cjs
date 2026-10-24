// English source keys already provide i18next's default text. Keep translations
// that differ from their keys, including punctuation and plural variants.
module.exports = function compactEnglish(source) {
  const data = JSON.parse(source.toString())
  const translation = Object.fromEntries(
    Object.entries(data.translation).filter(([key, value]) => key !== value)
  )
  return `export default ${JSON.stringify({ ...data, translation })}`
}

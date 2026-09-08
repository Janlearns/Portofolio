/* Shared validation for the editor and public portfolio. */
window.ProjectData = {
  categories: ['Prediction', 'Model', 'Chatbot', 'NLP', 'RAG', 'Recommender System'],
  validate(value) {
    if (!value || typeof value !== 'object') throw new Error('Data project tidak valid.');
    const result = {};
    for (const [key, limit] of Object.entries({ title: 120, category: 40, description: 3000, image: 2000, link: 2000, githubLink: 2000 })) {
      if (value[key] != null && typeof value[key] !== 'string') throw new Error('Data project tidak valid.');
      result[key] = (value[key] || '').trim();
      if (result[key].length > limit) throw new Error(`${key} terlalu panjang.`);
    }
    if (!result.title || !result.description || !this.categories.includes(result.category)) throw new Error('Isi judul, kategori, dan deskripsi.');
    for (const key of ['image', 'link', 'githubLink']) {
      if (result[key] && !['https:', 'http:'].includes(new URL(result[key]).protocol)) throw new Error('Link harus menggunakan https:// atau http://.');
    }
    return result;
  },
  escape(value) {
    return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }
};

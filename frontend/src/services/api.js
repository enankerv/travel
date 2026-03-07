// API service for villa scouting and management

export const api = {
  // Fetch all villas
  async getVillas() {
    const res = await fetch('/api/villas');
    if (!res.ok) throw new Error('Failed to fetch villas');
    return res.json();
  },

  // Scout a URL
  async scoutUrl(url, options = {}) {
    const body = { url };
    if (options.check_in) body.check_in = options.check_in;
    if (options.check_out) body.check_out = options.check_out;
    if (options.guests) body.guests = options.guests;

    const res = await fetch('/api/scout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('Scout request failed');
    return res.json();
  },

  // Scout from pasted text
  async scoutPaste(pastedText, originalUrl = null, imageUrls = []) {
    let text = pastedText;
    if (imageUrls.length) {
      text += '\n\n' + imageUrls.join('\n');
    }

    const body = { pasted_text: text };
    if (originalUrl) body.original_url = originalUrl;

    const res = await fetch('/api/scout-paste', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('Paste request failed');
    return res.json();
  },

  // Update villa fields
  async updateVilla(slug, updates) {
    const res = await fetch(`/api/villa/${slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Update failed');
    return res.json();
  },

  // Delete villa
  async deleteVilla(slug) {
    const res = await fetch(`/api/villa/${slug}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Delete failed');
    return res.json();
  },
};

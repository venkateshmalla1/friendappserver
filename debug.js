const express = require('express');
const app = express();

app.get('/api/status', (req, res) => {
  res.json({ message: "Express is alive!" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Debug server active at http://localhost:${PORT}`);
});

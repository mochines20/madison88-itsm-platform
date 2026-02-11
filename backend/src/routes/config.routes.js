const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    status: 'success',
    data: {
      attachment_required: process.env.ATTACHMENT_REQUIRED === 'true',
    },
  });
});

module.exports = router;

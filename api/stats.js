export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { locationId } = req.query;
  const apiKey = process.env.GHL_API_KEY;

  if (!locationId) {
    return res.status(400).json({ error: 'Missing locationId' });
  }

  try {
    const response = await fetch(`https://services.leadconnectorhq.com/opportunities/search?locationId=${locationId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    let totalSales = 0;
    const opportunities = data.opportunities || [];
    
    opportunities.forEach(opp => {
      totalSales += (opp.monetaryValue || 0);
    });

    return res.status(200).json({
      success: true,
      totalSales: totalSales,
      totalOrders: opportunities.length
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

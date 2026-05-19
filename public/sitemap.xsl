<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="2.0" 
                xmlns:html="http://www.w3.org/TR/REC-html40"
                xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
                xmlns:sitemap="http://www.sitemaps.org/schemas/sitemap/0.9"
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html" version="1.0" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html xmlns="http://www.w3.org/1999/xhtml">
      <head>
        <title>MasterCart XML Sitemap</title>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&amp;family=Plus+Jakarta+Sans:wght@300;400;500;600;700&amp;display=swap" rel="stylesheet" />
        <style type="text/css">
          body {
            font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background: radial-gradient(circle at top right, #1a103c 0%, #0b071e 60%, #03020c 100%);
            color: #e2e8f0;
            margin: 0;
            padding: 40px 20px;
            min-height: 100vh;
            line-height: 1.5;
          }
          .container {
            max-width: 1200px;
            margin: 0 auto;
          }
          .header {
            background: rgba(255, 255, 255, 0.03);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px rgba(255, 255, 255, 0.08) solid;
            border-radius: 24px;
            padding: 32px;
            margin-bottom: 30px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            position: relative;
            overflow: hidden;
          }
          .header::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(99, 102, 241, 0.1) 0%, transparent 50%);
            pointer-events: none;
          }
          .header h1 {
            font-family: 'Outfit', sans-serif;
            font-weight: 700;
            font-size: 2.5rem;
            margin: 0 0 10px 0;
            background: linear-gradient(135deg, #a5b4fc 0%, #6366f1 50%, #4f46e5 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .header p {
            margin: 0;
            color: #94a3b8;
            font-size: 1.1rem;
          }
          .stats {
            display: flex;
            gap: 20px;
            margin-top: 24px;
            flex-wrap: wrap;
          }
          .stat-box {
            background: rgba(255, 255, 255, 0.02);
            border: 1px rgba(255, 255, 255, 0.05) solid;
            padding: 12px 24px;
            border-radius: 14px;
            font-size: 0.95rem;
          }
          .stat-box strong {
            color: #818cf8;
            font-weight: 600;
          }
          .table-container {
            background: rgba(255, 255, 255, 0.02);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px rgba(255, 255, 255, 0.06) solid;
            border-radius: 24px;
            overflow: hidden;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
          }
          table {
            width: 100%;
            border-collapse: collapse;
            text-align: left;
          }
          th {
            background: rgba(255, 255, 255, 0.04);
            color: #94a3b8;
            font-family: 'Outfit', sans-serif;
            font-weight: 600;
            font-size: 0.9rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            padding: 18px 24px;
            border-bottom: 1px rgba(255, 255, 255, 0.08) solid;
          }
          tr {
            transition: all 0.2s ease;
          }
          tr:hover {
            background: rgba(99, 102, 241, 0.04);
          }
          tr:not(:last-child) td {
            border-bottom: 1px rgba(255, 255, 255, 0.04) solid;
          }
          td {
            padding: 18px 24px;
            font-size: 0.95rem;
            vertical-align: middle;
          }
          a {
            color: #a5b4fc;
            text-decoration: none;
            font-weight: 500;
            transition: color 0.15s ease;
          }
          a:hover {
            color: #818cf8;
            text-decoration: underline;
          }
          .badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.02em;
          }
          .badge-high {
            background: rgba(16, 185, 129, 0.1);
            color: #34d399;
            border: 1px rgba(16, 185, 129, 0.2) solid;
          }
          .badge-medium {
            background: rgba(99, 102, 241, 0.1);
            color: #818cf8;
            border: 1px rgba(99, 102, 241, 0.2) solid;
          }
          .badge-low {
            background: rgba(148, 163, 184, 0.1);
            color: #94a3b8;
            border: 1px rgba(148, 163, 184, 0.2) solid;
          }
          .footer {
            margin-top: 40px;
            text-align: center;
            color: #64748b;
            font-size: 0.85rem;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>MasterCart XML Sitemap</h1>
            <p>Generated dynamically for search engine indexing and public exploration.</p>
            <div class="stats">
              <div class="stat-box">
                Total URLs: <strong><xsl:value-of select="count(sitemap:urlset/sitemap:url)"/></strong>
              </div>
              <div class="stat-box">
                Target Domain: <strong>master-cart-camp.vercel.app</strong>
              </div>
            </div>
          </div>
          
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th width="50%">URL Loc</th>
                  <th width="15%">Priority</th>
                  <th width="15%">Change Freq</th>
                  <th width="20%">Last Modified</th>
                </tr>
              </thead>
              <tbody>
                <xsl:for-each select="sitemap:urlset/sitemap:url">
                  <xsl:sort select="sitemap:priority" order="descending"/>
                  <tr>
                    <td>
                      <xsl:variable name="itemURL">
                        <xsl:value-of select="sitemap:loc"/>
                      </xsl:variable>
                      <a href="{$itemURL}">
                        <xsl:value-of select="sitemap:loc"/>
                      </a>
                    </td>
                    <td>
                      <xsl:variable name="prio">
                        <xsl:value-of select="sitemap:priority"/>
                      </xsl:variable>
                      <span class="badge">
                        <xsl:attribute name="class">
                          <xsl:choose>
                            <xsl:when test="$prio &gt;= 0.8">badge badge-high</xsl:when>
                            <xsl:when test="$prio &gt;= 0.6">badge badge-medium</xsl:when>
                            <xsl:otherwise>badge badge-low</xsl:otherwise>
                          </xsl:choose>
                        </xsl:attribute>
                        <xsl:value-of select="sitemap:priority"/>
                      </span>
                    </td>
                    <td>
                      <xsl:value-of select="sitemap:changefreq"/>
                    </td>
                    <td>
                      <xsl:value-of select="sitemap:lastmod"/>
                    </td>
                  </tr>
                </xsl:for-each>
              </tbody>
            </table>
          </div>
          <div class="footer">
            Generated by MasterCart SEO Engine • <a href="https://master-cart-camp.vercel.app">Visit MasterCart Hub</a>
          </div>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>

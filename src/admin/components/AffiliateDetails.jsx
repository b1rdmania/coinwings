import React, { useState, useEffect } from 'react';
import { Card, Statistic, Row, Col, Button, message } from 'antd';
import { UserOutlined, MailOutlined, LinkOutlined } from '@ant-design/icons';

const AffiliateDetails = ({ code }) => {
  const [affiliate, setAffiliate] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAffiliateDetails();
  }, [code]);

  const fetchAffiliateDetails = async () => {
    try {
      const response = await fetch(`/api/admin/affiliates/${code}`);
      const data = await response.json();
      setAffiliate(data);
    } catch (error) {
      message.error('Failed to fetch affiliate details');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    message.success('Copied to clipboard!');
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!affiliate) {
    return <div>Affiliate not found</div>;
  }

  return (
    <div style={{ padding: '24px' }}>
      <Card title="Affiliate Details" loading={loading}>
        <Row gutter={[16, 16]}>
          <Col span={8}>
            <Card>
              <Statistic
                title="Total Leads"
                value={affiliate.totalLeads}
                prefix={<UserOutlined />}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="Last Used"
                value={affiliate.lastUsed ? new Date(affiliate.lastUsed).toLocaleDateString() : 'Never'}
                prefix={<LinkOutlined />}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="Status"
                value={affiliate.status}
                valueStyle={{ color: affiliate.status === 'active' ? 'green' : 'red' }}
              />
            </Card>
          </Col>
        </Row>

        <Card style={{ marginTop: '24px' }}>
          <h3>Contact Information</h3>
          <p>
            <UserOutlined /> Name: {affiliate.name}
          </p>
          <p>
            <MailOutlined /> Email: {affiliate.email}
          </p>
          <p>
            <LinkOutlined /> Code: {affiliate.code}
            <Button
              type="text"
              icon={<LinkOutlined />}
              onClick={() => copyToClipboard(affiliate.code)}
            />
          </p>
        </Card>

        <Card style={{ marginTop: '24px' }}>
          <h3>Payment Details</h3>
          <p>Crypto Address: {affiliate.paymentDetails.cryptoAddress}</p>
          <p>Preferred Currency: {affiliate.paymentDetails.preferredCurrency}</p>
        </Card>

        <Card style={{ marginTop: '24px' }}>
          <h3>Affiliate Links</h3>
          <p>
            Website Link:
            <br />
            <code>
              https://coinwings.com/private-jets?ref={affiliate.code}
            </code>
            <Button
              type="text"
              icon={<LinkOutlined />}
              onClick={() => copyToClipboard(`https://coinwings.com/private-jets?ref=${affiliate.code}`)}
            />
          </p>
          <p>
            Telegram Link:
            <br />
            <code>
              https://t.me/CoinWingsBot?start={affiliate.code}
            </code>
            <Button
              type="text"
              icon={<LinkOutlined />}
              onClick={() => copyToClipboard(`https://t.me/CoinWingsBot?start=${affiliate.code}`)}
            />
          </p>
        </Card>
      </Card>
    </div>
  );
};

export default AffiliateDetails; 
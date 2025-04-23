import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, message } from 'antd';
import { PlusOutlined, CopyOutlined } from '@ant-design/icons';

const AffiliateDashboard = () => {
  const [affiliates, setAffiliates] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();

  // Fetch affiliates on component mount
  useEffect(() => {
    fetchAffiliates();
  }, []);

  const fetchAffiliates = async () => {
    try {
      const response = await fetch('/api/admin/affiliates');
      const data = await response.json();
      setAffiliates(Object.values(data));
    } catch (error) {
      message.error('Failed to fetch affiliates');
    }
  };

  const handleCreateAffiliate = async (values) => {
    try {
      const response = await fetch('/api/admin/affiliates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });
      const { code } = await response.json();
      message.success(`Affiliate created with code: ${code}`);
      setIsModalVisible(false);
      form.resetFields();
      fetchAffiliates();
    } catch (error) {
      message.error('Failed to create affiliate');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    message.success('Copied to clipboard!');
  };

  const columns = [
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      render: (text) => (
        <span>
          {text}
          <Button
            type="text"
            icon={<CopyOutlined />}
            onClick={() => copyToClipboard(text)}
          />
        </span>
      ),
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <span style={{ color: status === 'active' ? 'green' : 'red' }}>
          {status}
        </span>
      ),
    },
    {
      title: 'Total Leads',
      dataIndex: 'totalLeads',
      key: 'totalLeads',
    },
    {
      title: 'Last Used',
      dataIndex: 'lastUsed',
      key: 'lastUsed',
      render: (timestamp) => timestamp ? new Date(timestamp).toLocaleDateString() : 'Never',
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h1>Affiliate Management</h1>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setIsModalVisible(true)}
        >
          Create Affiliate
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={affiliates}
        rowKey="code"
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title="Create New Affiliate"
        visible={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateAffiliate}
        >
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'Please enter name' }]}
          >
            <input />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Please enter email' },
              { type: 'email', message: 'Please enter a valid email' }
            ]}
          >
            <input />
          </Form.Item>

          <Form.Item
            name="cryptoAddress"
            label="Crypto Address"
            rules={[{ required: true, message: 'Please enter crypto address' }]}
          >
            <input />
          </Form.Item>

          <Form.Item
            name="preferredCurrency"
            label="Preferred Currency"
            initialValue="USDC"
          >
            <select>
              <option value="USDC">USDC</option>
              <option value="BTC">BTC</option>
              <option value="ETH">ETH</option>
            </select>
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit">
              Create Affiliate
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AffiliateDashboard; 
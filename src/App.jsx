import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import AffiliateDashboard from './admin/components/AffiliateDashboard';
import AffiliateDetails from './admin/components/AffiliateDetails';

const { Header, Content } = Layout;

const App = () => {
  return (
    <Router>
      <Layout style={{ minHeight: '100vh' }}>
        <Header>
          <Menu theme="dark" mode="horizontal">
            <Menu.Item key="1">
              <Link to="/admin/affiliates">Affiliate Management</Link>
            </Menu.Item>
          </Menu>
        </Header>
        <Content style={{ padding: '24px' }}>
          <Routes>
            <Route path="/admin/affiliates" element={<AffiliateDashboard />} />
            <Route path="/admin/affiliates/:code" element={<AffiliateDetails />} />
          </Routes>
        </Content>
      </Layout>
    </Router>
  );
};

export default App; 
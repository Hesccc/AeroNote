import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home';
import { PostDetail } from './pages/PostDetail';
import { Login } from './pages/Login';
import { LoginCallback } from './pages/LoginCallback';

// 公共二级页面异步加载
const Archives = lazy(() => import('./pages/Archives').then(m => ({ default: m.Archives })));
const Categories = lazy(() => import('./pages/Categories').then(m => ({ default: m.Categories })));
const Tags = lazy(() => import('./pages/Tags').then(m => ({ default: m.Tags })));
const About = lazy(() => import('./pages/About').then(m => ({ default: m.About })));

// 管理后台高重型页面按需懒加载 (Code Splitting)
const AdminDashboard = lazy(() => import('./pages/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const AdminPosts = lazy(() => import('./pages/AdminPosts').then(m => ({ default: m.AdminPosts })));
const AdminPostEdit = lazy(() => import('./pages/AdminPostEdit').then(m => ({ default: m.AdminPostEdit })));
const AdminCategories = lazy(() => import('./pages/AdminCategories').then(m => ({ default: m.AdminCategories })));
const AdminSettings = lazy(() => import('./pages/AdminSettings').then(m => ({ default: m.AdminSettings })));
const AdminPassword = lazy(() => import('./pages/AdminPassword').then(m => ({ default: m.AdminPassword })));
const AdminOssImages = lazy(() => import('./pages/AdminOssImages').then(m => ({ default: m.AdminOssImages })));
const AdminBackups = lazy(() => import('./pages/AdminBackups').then(m => ({ default: m.AdminBackups })));

const RouteLoading: React.FC = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', width: '100%' }}>
    <div
      className="login-spin"
      style={{
        width: 32,
        height: 32,
        borderWidth: 3,
        borderColor: 'var(--border-color, #e2e8f0)',
        borderTopColor: 'var(--color-primary, #10b981)',
      }}
    />
  </div>
);

function App() {
  return (
    <Router>
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/posts/:id" element={<PostDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/login/callback" element={<LoginCallback />} />
          <Route path="/archives" element={<Archives />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/tags" element={<Tags />} />
          <Route path="/about" element={<About />} />
          
          {/* Admin Routes */}
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/posts" element={<AdminPosts />} />
          <Route path="/admin/posts/new" element={<AdminPostEdit />} />
          <Route path="/admin/posts/edit/:id" element={<AdminPostEdit />} />
          <Route path="/admin/categories" element={<AdminCategories activeTab="categories" />} />
          <Route path="/admin/tags" element={<AdminCategories activeTab="tags" />} />
          <Route path="/admin/settings" element={<AdminSettings mode="system" />} />
          <Route path="/admin/ai-settings" element={<AdminSettings mode="ai" />} />
          <Route path="/admin/password" element={<AdminPassword />} />
          <Route path="/admin/oss-images" element={<AdminOssImages />} />
          <Route path="/admin/backups" element={<AdminBackups />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;

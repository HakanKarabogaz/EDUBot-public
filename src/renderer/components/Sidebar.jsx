/**
 * Sidebar.jsx
 * Hierarchical navigation sidebar with collapsible categories
 */

import React, { useState, useEffect } from 'react';
import { 
    Home, 
    Workflow, 
    Database, 
    BarChart3, 
    Settings, 
    HelpCircle,
    ChevronRight,
    ChevronDown,
    Menu,
    X
} from 'lucide-react';
import './Sidebar.css';

const Sidebar = ({ currentView, onViewChange }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [categories, setCategories] = useState([]);
    const [expandedCategories, setExpandedCategories] = useState(new Set());
    const [loading, setLoading] = useState(true);

    // Load categories on mount
    useEffect(() => {
        loadCategories();
    }, []);

    const loadCategories = async () => {
        try {
            setLoading(true);
            const result = await window.electronAPI.categories.getTree();
            if (result.success) {
                setCategories(result.data);
                // Expand first level by default
                const firstLevelIds = result.data.map(cat => cat.id);
                setExpandedCategories(new Set(firstLevelIds));
            }
        } catch (error) {
            console.error('Kategoriler yüklenemedi:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleCategory = (categoryId) => {
        const newExpanded = new Set(expandedCategories);
        if (newExpanded.has(categoryId)) {
            newExpanded.delete(categoryId);
        } else {
            newExpanded.add(categoryId);
        }
        setExpandedCategories(newExpanded);
    };

    const handleCategoryClick = (category) => {
        // Navigate to workflows view filtered by category
        onViewChange('workflows', { categoryId: category.id });
    };

    const renderCategory = (category, level = 0) => {
        const hasChildren = category.children && category.children.length > 0;
        const isExpanded = expandedCategories.has(category.id);

        return (
            <div key={category.id} className="sidebar-category" style={{ paddingLeft: `${level * 16}px` }}>
                <div 
                    className="sidebar-category-header"
                    onClick={() => hasChildren ? toggleCategory(category.id) : handleCategoryClick(category)}
                >
                    {hasChildren && (
                        <span className="category-toggle">
                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </span>
                    )}
                    <span className="category-icon">{category.icon}</span>
                    {!isCollapsed && (
                        <>
                            <span className="category-name">{category.name}</span>
                            {category.workflow_count > 0 && (
                                <span className="category-count">{category.workflow_count}</span>
                            )}
                        </>
                    )}
                </div>
                
                {hasChildren && isExpanded && !isCollapsed && (
                    <div className="sidebar-category-children">
                        {category.children.map(child => renderCategory(child, level + 1))}
                    </div>
                )}
            </div>
        );
    };

    const menuItems = [
        { id: 'dashboard', icon: <Home size={20} />, label: 'Ana Sayfa', view: 'dashboard' },
        { 
            id: 'workflows', 
            icon: <Workflow size={20} />, 
            label: 'Workflows', 
            view: 'workflows',
            hasCategories: true
        },
        { id: 'dataSources', icon: <Database size={20} />, label: 'Veri Kaynakları', view: 'dataSources' },
        { id: 'stats', icon: <BarChart3 size={20} />, label: 'İstatistikler', view: 'statistics' },
        { 
            id: 'settings', 
            icon: <Settings size={20} />, 
            label: 'Ayarlar', 
            view: 'settings',
            hasSubmenu: true,
            submenu: [
                { id: 'category-manager', label: 'Kategori Yönetimi', view: 'category-manager' },
                { id: 'system-settings', label: 'Sistem Ayarları', view: 'system-settings' }
            ]
        },
        { id: 'help', icon: <HelpCircle size={20} />, label: 'Yardım', view: 'help' }
    ];

    return (
        <div className={`sidebar ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
            {/* Header */}
            <div className="sidebar-header">
                <div className="sidebar-logo">
                    {!isCollapsed && <span className="logo-text">EDUBot</span>}
                </div>
                <button 
                    className="sidebar-toggle-btn"
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    title={isCollapsed ? 'Menüyü Aç' : 'Menüyü Kapat'}
                >
                    {isCollapsed ? <Menu size={20} /> : <X size={20} />}
                </button>
            </div>

            {/* Menu Items */}
            <nav className="sidebar-nav">
                {menuItems.map(item => (
                    <div key={item.id} className="sidebar-menu-section">
                        <div 
                            className={`sidebar-menu-item ${currentView === item.view ? 'active' : ''}`}
                            onClick={() => {
                                if (!item.hasCategories && !item.hasSubmenu) {
                                    onViewChange(item.view);
                                } else if (item.hasSubmenu) {
                                    toggleCategory(`menu-${item.id}`);
                                } else if (item.hasCategories) {
                                    toggleCategory(`menu-${item.id}`);
                                }
                            }}
                        >
                            <span className="menu-icon">{item.icon}</span>
                            {!isCollapsed && (
                                <>
                                    <span className="menu-label">{item.label}</span>
                                    {(item.hasSubmenu || item.hasCategories) && (
                                        <span className="category-toggle" style={{ marginLeft: 'auto' }}>
                                            {expandedCategories.has(`menu-${item.id}`) ? 
                                                <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                        </span>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Show categories under Workflows */}
                        {item.hasCategories && !isCollapsed && expandedCategories.has(`menu-${item.id}`) && (
                            <div className="sidebar-categories">
                                {loading ? (
                                    <div className="categories-loading">Yükleniyor...</div>
                                ) : (
                                    categories.map(category => renderCategory(category, 0))
                                )}
                            </div>
                        )}

                        {/* Show submenu under Settings */}
                        {item.hasSubmenu && !isCollapsed && expandedCategories.has(`menu-${item.id}`) && (
                            <div className="sidebar-submenu">
                                {item.submenu.map(subItem => (
                                    <div
                                        key={subItem.id}
                                        className={`sidebar-submenu-item ${currentView === subItem.view ? 'active' : ''}`}
                                        onClick={() => onViewChange(subItem.view)}
                                    >
                                        <span className="submenu-label">{subItem.label}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </nav>

            {/* Footer */}
            {!isCollapsed && (
                <div className="sidebar-footer">
                    <div className="sidebar-version">v0.1.0</div>
                </div>
            )}
        </div>
    );
};

export default Sidebar;

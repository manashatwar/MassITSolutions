import React from 'react';
import { Meta, StoryFn } from '@storybook/react';
import { StoryProvider, TestingRouterContext } from '@openmsupply-client/common';
import Dashboard from './DashboardService';

export default {
  title: 'Dashboard/Dashboard',
  component: Dashboard,
  parameters: {
    layout: 'fullscreen',
    routes: ['/dashboard'],
  },
} as Meta<typeof Dashboard>;

const Template: StoryFn<typeof Dashboard> = () => (
  <StoryProvider>
    <TestingRouterContext initialEntries={['/dashboard']}>
      <div style={{ padding: 16, background: '#f4f5f7', minHeight: '100vh' }}>
        <Dashboard />
      </div>
    </TestingRouterContext>
  </StoryProvider>
);

export const Default = Template.bind({});
Default.storyName = 'Dashboard (no backend)';

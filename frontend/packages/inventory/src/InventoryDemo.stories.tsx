import React from 'react';
import { Meta, StoryFn } from '@storybook/react';
import { StoryProvider, TestingRouterContext } from '@openmsupply-client/common';
import { ListView as StocktakeListView } from './Stocktake/ListView';

export default {
  title: 'Inventory/Stocktake List',
  component: StocktakeListView,
  parameters: {
    layout: 'fullscreen',
    routes: ['/inventory/stocktakes'],
  },
} as Meta<typeof StocktakeListView>;

const Template: StoryFn<typeof StocktakeListView> = () => (
  <StoryProvider>
    <TestingRouterContext initialEntries={['/inventory/stocktakes']}>
      <StocktakeListView />
    </TestingRouterContext>
  </StoryProvider>
);

export const Default = Template.bind({});
Default.storyName = 'Stocktake List (no backend)';

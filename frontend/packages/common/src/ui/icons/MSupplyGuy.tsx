import React, { FC } from 'react';
import { styled } from '@mui/material/styles';

const logo = 'https://www.massitsolutions.co.in/images/massitsolutions-logo.png';

type MSupplyGuyProps = {
  size?: 'large' | 'medium';
  style?: React.CSSProperties;
};

const sizes = {
  large: { height: 60 },
  medium: { height: 40 },
};

const LogoImage: FC<MSupplyGuyProps> = props => {
  const { size, style, ...rest } = props;
  const sizeStyle = size ? sizes[size] : { height: 40 };
  return (
    <img 
      src={logo} 
      alt="Mass IT Solutions" 
      style={{ ...sizeStyle, ...style, objectFit: 'contain' }} 
      {...rest} 
    />
  );
};

export const MSupplyGuy = LogoImage;

export const AnimatedMSupplyGuy = styled(LogoImage)(({ theme }) => {
  return {
    transition: theme.transitions.create('width', {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
  };
});

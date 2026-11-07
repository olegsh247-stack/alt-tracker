// Клиентская часть каталога Cross (без серверных импортов).
import { COMMODITIES } from './commodities';
export const CROSS_COMMODITIES = COMMODITIES.filter(c => c.ticker);

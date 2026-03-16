-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Máy chủ: 127.0.0.1
-- Thời gian đã tạo: Th3 16, 2026 lúc 08:41 AM
-- Phiên bản máy phục vụ: 10.4.32-MariaDB
-- Phiên bản PHP: 8.0.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Cơ sở dữ liệu: `rcv`
--

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `contestants`
--

CREATE TABLE `contestants` (
  `id` int(11) NOT NULL,
  `name` varchar(200) NOT NULL,
  `card_id` int(11) NOT NULL,
  `contest_id` int(11) DEFAULT NULL,
  `status` enum('active','eliminated','winner') NOT NULL,
  `eliminated_at_question` int(11) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Đang đổ dữ liệu cho bảng `contestants`
--

INSERT INTO `contestants` (`id`, `name`, `card_id`, `contest_id`, `status`, `eliminated_at_question`, `created_at`) VALUES
(1, 'Nguyễn Văn An', 1, 2, 'winner', NULL, '2026-03-10 01:07:56'),
(2, 'Trần Thị Bình', 2, 2, 'winner', NULL, '2026-03-10 01:07:56'),
(3, 'Lê Hoàng Nam', 3, 2, 'winner', NULL, '2026-03-10 01:07:56'),
(4, 'Phạm Minh Đức', 4, 2, 'winner', NULL, '2026-03-10 01:07:56'),
(5, 'Vũ Thu Thảo', 5, 2, 'winner', NULL, '2026-03-10 01:07:56'),
(6, 'Đặng Hùng Dũng', 6, 2, 'winner', NULL, '2026-03-10 01:07:56'),
(7, 'Ngô Bảo Châu', 7, 2, 'winner', NULL, '2026-03-10 01:07:56'),
(8, 'Đỗ Thùy Linh', 8, 2, 'winner', NULL, '2026-03-10 01:07:56'),
(9, 'Bùi Anh Tuấn', 9, 2, 'winner', NULL, '2026-03-10 01:07:56'),
(10, 'Lý Gia Hân', 10, 2, 'winner', NULL, '2026-03-10 01:07:56'),
(11, 'Chu Quang Khải', 11, 2, 'winner', NULL, '2026-03-10 01:07:56'),
(12, 'Trịnh Kim Chi', 12, 2, 'winner', NULL, '2026-03-10 01:07:56'),
(13, 'Nguyễn Hải Đăng', 13, 2, 'winner', NULL, '2026-03-10 01:07:56'),
(14, 'Hoàng Thanh Trúc', 14, 2, 'winner', NULL, '2026-03-10 01:07:56'),
(15, 'Mai Xuân Trường', 15, 2, 'winner', NULL, '2026-03-10 01:07:56'),
(16, 'Phan Bích Diệp', 16, 2, 'winner', NULL, '2026-03-10 01:07:56'),
(17, 'Hồ Sỹ Hùng', 17, 2, 'winner', NULL, '2026-03-10 01:07:56'),
(18, 'Cao Minh Tuyết', 18, 2, 'winner', NULL, '2026-03-10 01:07:56'),
(19, 'Dương Quốc Anh', 19, 2, 'winner', NULL, '2026-03-10 01:07:56'),
(20, 'Đinh Công Thành', 20, 2, 'winner', NULL, '2026-03-10 01:07:56'),
(21, 'Quách Ngọc Hải', 21, 2, 'winner', NULL, '2026-03-10 01:07:56'),
(22, 'Trần Đức Bo', 22, 2, 'winner', NULL, '2026-03-10 01:07:56'),
(23, 'Lê Thị Thắm', 23, 2, 'winner', NULL, '2026-03-10 01:07:56'),
(24, 'Phạm Hồng Sơn', 24, 2, 'winner', NULL, '2026-03-10 01:07:56'),
(25, 'Nguyễn Bích Phương', 25, 2, 'winner', NULL, '2026-03-10 01:07:56'),
(26, 'Lương Gia Huy', 26, 2, 'winner', NULL, '2026-03-10 01:07:56'),
(27, 'Võ Hoàng Yến', 27, 2, 'winner', NULL, '2026-03-10 01:07:56'),
(28, 'Tạ Minh Tâm', 28, 2, 'winner', NULL, '2026-03-10 01:07:56'),
(29, 'Diệp Bảo Ngọc', 29, 2, 'winner', NULL, '2026-03-10 01:07:56'),
(30, 'Phan Thanh Bình', 30, 2, 'winner', NULL, '2026-03-10 01:07:56'),
(31, 'Nguyễn Hữu Thắng', 31, 2, 'winner', NULL, '2026-03-10 01:07:56'),
(32, 'Trần Minh Vương', 32, 2, 'winner', NULL, '2026-03-10 01:07:56'),
(33, 'Lê Văn Xuân', 33, 2, 'winner', NULL, '2026-03-10 01:07:56'),
(34, 'Phạm Tuấn Hải', 34, 2, 'winner', NULL, '2026-03-10 01:07:56'),
(35, 'Nguyễn Quang Hải', 35, 2, 'winner', NULL, '2026-03-10 01:07:56'),
(36, 'Đỗ Hùng Dũng', 36, 2, 'winner', NULL, '2026-03-10 01:07:56'),
(37, 'Quế Ngọc Hải', 37, 2, 'winner', NULL, '2026-03-10 01:07:56'),
(38, 'Nguyễn Tiến Linh', 38, 2, 'winner', NULL, '2026-03-10 01:07:56'),
(39, 'Bùi Tiến Dũng', 39, 2, 'winner', NULL, '2026-03-10 01:07:56'),
(40, 'Đặng Văn Lâm', 40, 2, 'winner', NULL, '2026-03-10 01:07:56'),
(41, 'Nguyễn Phong Hồng Duy', 41, 2, 'winner', NULL, '2026-03-10 01:07:56'),
(42, 'Vũ Văn Thanh', 42, 2, 'winner', NULL, '2026-03-10 01:07:56'),
(43, 'Lương Xuân Trường', 43, 2, 'winner', NULL, '2026-03-10 01:07:56'),
(44, 'Nguyễn Tuấn Anh', 44, 2, 'winner', NULL, '2026-03-10 01:07:56'),
(45, 'Phạm Đức Huy', 45, 2, 'winner', NULL, '2026-03-10 01:07:56'),
(46, 'Trần Đình Trọng', 46, 2, 'winner', NULL, '2026-03-10 01:07:56'),
(47, 'Đỗ Duy Mạnh', 47, 2, 'winner', NULL, '2026-03-10 01:07:56'),
(48, 'Nguyễn Thành Chung', 48, 2, 'winner', NULL, '2026-03-10 01:07:56'),
(49, 'Đoàn Văn Hậu', 49, 2, 'winner', NULL, '2026-03-10 01:07:56'),
(50, 'Hồ Tấn Tài', 50, 2, 'winner', NULL, '2026-03-10 01:07:56'),
(51, 'Nguyễn Văn An', 51, 1, 'winner', NULL, '2026-03-10 01:11:41'),
(52, 'Trần Thị Bình', 53, 1, 'winner', NULL, '2026-03-10 01:11:41'),
(53, 'Lê Hoàng Nam', 56, 1, 'winner', NULL, '2026-03-10 01:11:41'),
(54, 'Phạm Minh Đức', 60, 1, 'winner', NULL, '2026-03-10 01:11:41'),
(55, 'Vũ Thu Thảo', 65, 1, 'winner', NULL, '2026-03-10 01:11:41'),
(56, 'Đặng Hùng Dũng', 71, 1, 'winner', NULL, '2026-03-10 01:11:41'),
(57, 'Ngô Bảo Châu', 78, 1, 'winner', NULL, '2026-03-10 01:11:41'),
(58, 'Đỗ Thùy Linh', 86, 1, 'winner', NULL, '2026-03-10 01:11:41'),
(59, 'Bùi Anh Tuấn', 95, 1, 'winner', NULL, '2026-03-10 01:11:41'),
(60, 'Lý Gia Hân', 105, 1, 'winner', NULL, '2026-03-10 01:11:41'),
(61, 'Chu Quang Khải', 116, 1, 'winner', NULL, '2026-03-10 01:11:41'),
(62, 'Trịnh Kim Chi', 128, 1, 'winner', NULL, '2026-03-10 01:11:41'),
(63, 'Nguyễn Hải Đăng', 141, 1, 'winner', NULL, '2026-03-10 01:11:41'),
(64, 'Hoàng Thanh Trúc', 155, 1, 'winner', NULL, '2026-03-10 01:11:41'),
(65, 'Mai Xuân Trường', 170, 1, 'winner', NULL, '2026-03-10 01:11:41'),
(66, 'Phan Bích Diệp', 186, 1, 'winner', NULL, '2026-03-10 01:11:41'),
(67, 'Hồ Sỹ Hùng', 203, 1, 'winner', NULL, '2026-03-10 01:11:41'),
(68, 'Cao Minh Tuyết', 221, 1, 'winner', NULL, '2026-03-10 01:11:41'),
(69, 'Dương Quốc Anh', 240, 1, 'winner', NULL, '2026-03-10 01:11:41'),
(70, 'Đinh Công Thành', 260, 1, 'winner', NULL, '2026-03-10 01:11:41'),
(71, 'Quách Ngọc Hải', 281, 1, 'winner', NULL, '2026-03-10 01:11:41'),
(72, 'Trần Đức Bo', 303, 1, 'winner', NULL, '2026-03-10 01:11:41'),
(73, 'Lê Thị Thắm', 326, 1, 'winner', NULL, '2026-03-10 01:11:41'),
(74, 'Phạm Hồng Sơn', 350, 1, 'winner', NULL, '2026-03-10 01:11:41'),
(75, 'Nguyễn Bích Phương', 375, 1, 'winner', NULL, '2026-03-10 01:11:41'),
(76, 'Lương Gia Huy', 401, 1, 'winner', NULL, '2026-03-10 01:11:41'),
(77, 'Võ Hoàng Yến', 428, 1, 'winner', NULL, '2026-03-10 01:11:41'),
(78, 'Tạ Minh Tâm', 456, 1, 'winner', NULL, '2026-03-10 01:11:41'),
(79, 'Diệp Bảo Ngọc', 485, 1, 'winner', NULL, '2026-03-10 01:11:41'),
(80, 'Phan Thanh Bình', 515, 1, 'winner', NULL, '2026-03-10 01:11:41'),
(81, 'Nguyễn Hữu Thắng', 546, 1, 'winner', NULL, '2026-03-10 01:11:41'),
(82, 'Trần Minh Vương', 578, 1, 'winner', NULL, '2026-03-10 01:11:41'),
(83, 'Lê Văn Xuân', 611, 1, 'winner', NULL, '2026-03-10 01:11:41'),
(84, 'Phạm Tuấn Hải', 645, 1, 'winner', NULL, '2026-03-10 01:11:41'),
(85, 'Nguyễn Quang Hải', 680, 1, 'winner', NULL, '2026-03-10 01:11:41'),
(86, 'Đỗ Hùng Dũng', 716, 1, 'winner', NULL, '2026-03-10 01:11:41'),
(87, 'Quế Ngọc Hải', 753, 1, 'winner', NULL, '2026-03-10 01:11:41'),
(88, 'Nguyễn Tiến Linh', 791, 1, 'winner', NULL, '2026-03-10 01:11:41'),
(89, 'Bùi Tiến Dũng', 830, 1, 'winner', NULL, '2026-03-10 01:11:41'),
(90, 'Đặng Văn Lâm', 870, 1, 'winner', NULL, '2026-03-10 01:11:41'),
(91, 'Nguyễn Phong Hồng Duy', 911, 1, 'winner', NULL, '2026-03-10 01:11:41'),
(92, 'Vũ Văn Thanh', 953, 1, 'winner', NULL, '2026-03-10 01:11:41'),
(93, 'Lương Xuân Trường', 996, 1, 'winner', NULL, '2026-03-10 01:11:41'),
(94, 'Nguyễn Tuấn Anh', 1040, 1, 'winner', NULL, '2026-03-10 01:11:41'),
(95, 'Phạm Đức Huy', 1085, 1, 'winner', NULL, '2026-03-10 01:11:41'),
(96, 'Trần Đình Trọng', 1131, 1, 'winner', NULL, '2026-03-10 01:11:41'),
(97, 'Đỗ Duy Mạnh', 1178, 1, 'winner', NULL, '2026-03-10 01:11:41'),
(98, 'Nguyễn Thành Chung', 1226, 1, 'winner', NULL, '2026-03-10 01:11:41'),
(99, 'Đoàn Văn Hậu', 1275, 1, 'winner', NULL, '2026-03-10 01:11:41'),
(100, 'Hồ Tấn Tài', 1325, 1, 'winner', NULL, '2026-03-10 01:11:41'),
(101, 'Nguyễn Văn An', 1326, 2, 'winner', NULL, '2026-03-10 01:26:08'),
(102, 'Trần Thị Bình', 1328, 2, 'winner', NULL, '2026-03-10 01:26:08'),
(103, 'Lê Hoàng Nam', 1331, 2, 'winner', NULL, '2026-03-10 01:26:08'),
(104, 'Phạm Minh Đức', 1335, 2, 'winner', NULL, '2026-03-10 01:26:08'),
(105, 'Vũ Thu Thảo', 1340, 2, 'winner', NULL, '2026-03-10 01:26:08'),
(106, 'Đặng Hùng Dũng', 1346, 2, 'winner', NULL, '2026-03-10 01:26:08'),
(107, 'Ngô Bảo Châu', 1353, 2, 'winner', NULL, '2026-03-10 01:26:08'),
(108, 'Đỗ Thùy Linh', 1361, 2, 'winner', NULL, '2026-03-10 01:26:08'),
(109, 'Bùi Anh Tuấn', 1370, 2, 'winner', NULL, '2026-03-10 01:26:08'),
(110, 'Lý Gia Hân', 1380, 2, 'winner', NULL, '2026-03-10 01:26:08'),
(111, 'Chu Quang Khải', 1391, 2, 'winner', NULL, '2026-03-10 01:26:08'),
(112, 'Trịnh Kim Chi', 1403, 2, 'winner', NULL, '2026-03-10 01:26:08'),
(113, 'Nguyễn Hải Đăng', 1416, 2, 'winner', NULL, '2026-03-10 01:26:08'),
(114, 'Hoàng Thanh Trúc', 1430, 2, 'winner', NULL, '2026-03-10 01:26:08'),
(115, 'Mai Xuân Trường', 1445, 2, 'winner', NULL, '2026-03-10 01:26:08'),
(116, 'Phan Bích Diệp', 1461, 2, 'winner', NULL, '2026-03-10 01:26:08'),
(117, 'Hồ Sỹ Hùng', 1478, 2, 'winner', NULL, '2026-03-10 01:26:08'),
(118, 'Cao Minh Tuyết', 1496, 2, 'winner', NULL, '2026-03-10 01:26:08'),
(119, 'Dương Quốc Anh', 1515, 2, 'winner', NULL, '2026-03-10 01:26:08'),
(120, 'Đinh Công Thành', 1535, 2, 'winner', NULL, '2026-03-10 01:26:08'),
(121, 'Quách Ngọc Hải', 1556, 2, 'winner', NULL, '2026-03-10 01:26:08'),
(122, 'Trần Đức Bo', 1578, 2, 'winner', NULL, '2026-03-10 01:26:08'),
(123, 'Lê Thị Thắm', 1601, 2, 'winner', NULL, '2026-03-10 01:26:08'),
(124, 'Phạm Hồng Sơn', 1625, 2, 'winner', NULL, '2026-03-10 01:26:08'),
(125, 'Nguyễn Bích Phương', 1650, 2, 'winner', NULL, '2026-03-10 01:26:08'),
(126, 'Lương Gia Huy', 1676, 2, 'winner', NULL, '2026-03-10 01:26:08'),
(127, 'Võ Hoàng Yến', 1703, 2, 'winner', NULL, '2026-03-10 01:26:08'),
(128, 'Tạ Minh Tâm', 1731, 2, 'winner', NULL, '2026-03-10 01:26:08'),
(129, 'Diệp Bảo Ngọc', 1760, 2, 'winner', NULL, '2026-03-10 01:26:08'),
(130, 'Phan Thanh Bình', 1790, 2, 'winner', NULL, '2026-03-10 01:26:08'),
(131, 'Nguyễn Hữu Thắng', 1821, 2, 'winner', NULL, '2026-03-10 01:26:08'),
(132, 'Trần Minh Vương', 1853, 2, 'winner', NULL, '2026-03-10 01:26:08'),
(133, 'Lê Văn Xuân', 1886, 2, 'winner', NULL, '2026-03-10 01:26:08'),
(134, 'Phạm Tuấn Hải', 1920, 2, 'winner', NULL, '2026-03-10 01:26:08'),
(135, 'Nguyễn Quang Hải', 1955, 2, 'winner', NULL, '2026-03-10 01:26:08'),
(136, 'Đỗ Hùng Dũng', 1991, 2, 'winner', NULL, '2026-03-10 01:26:08'),
(137, 'Quế Ngọc Hải', 2028, 2, 'winner', NULL, '2026-03-10 01:26:08'),
(138, 'Nguyễn Tiến Linh', 2066, 2, 'winner', NULL, '2026-03-10 01:26:08'),
(139, 'Bùi Tiến Dũng', 2105, 2, 'winner', NULL, '2026-03-10 01:26:08'),
(140, 'Đặng Văn Lâm', 2145, 2, 'winner', NULL, '2026-03-10 01:26:08'),
(141, 'Nguyễn Phong Hồng Duy', 2186, 2, 'winner', NULL, '2026-03-10 01:26:08'),
(142, 'Vũ Văn Thanh', 2228, 2, 'winner', NULL, '2026-03-10 01:26:08'),
(143, 'Lương Xuân Trường', 2271, 2, 'winner', NULL, '2026-03-10 01:26:08'),
(144, 'Nguyễn Tuấn Anh', 2315, 2, 'winner', NULL, '2026-03-10 01:26:08'),
(145, 'Phạm Đức Huy', 2360, 2, 'winner', NULL, '2026-03-10 01:26:08'),
(146, 'Trần Đình Trọng', 2406, 2, 'winner', NULL, '2026-03-10 01:26:08'),
(147, 'Đỗ Duy Mạnh', 2453, 2, 'winner', NULL, '2026-03-10 01:26:08'),
(148, 'Nguyễn Thành Chung', 2501, 2, 'winner', NULL, '2026-03-10 01:26:08'),
(149, 'Đoàn Văn Hậu', 2550, 2, 'winner', NULL, '2026-03-10 01:26:08'),
(150, 'Hồ Tấn Tài', 2600, 2, 'winner', NULL, '2026-03-10 01:26:08'),
(151, 'Nguyễn Văn An', 2601, 2, 'active', NULL, '2026-03-10 01:31:07'),
(152, 'Trần Thị Bình', 2603, 2, 'active', NULL, '2026-03-10 01:31:07'),
(153, 'Lê Hoàng Nam', 2606, 2, 'active', NULL, '2026-03-10 01:31:07'),
(154, 'Phạm Minh Đức', 2610, 2, 'active', NULL, '2026-03-10 01:31:07'),
(155, 'Vũ Thu Thảo', 2615, 2, 'active', NULL, '2026-03-10 01:31:07'),
(156, 'Đặng Hùng Dũng', 2621, 2, 'active', NULL, '2026-03-10 01:31:07'),
(157, 'Ngô Bảo Châu', 2628, 2, 'active', NULL, '2026-03-10 01:31:07'),
(158, 'Đỗ Thùy Linh', 2636, 2, 'active', NULL, '2026-03-10 01:31:07'),
(159, 'Bùi Anh Tuấn', 2645, 2, 'active', NULL, '2026-03-10 01:31:07'),
(160, 'Lý Gia Hân', 2655, 2, 'active', NULL, '2026-03-10 01:31:07'),
(161, 'Chu Quang Khải', 2666, 2, 'active', NULL, '2026-03-10 01:31:07'),
(162, 'Trịnh Kim Chi', 2678, 2, 'active', NULL, '2026-03-10 01:31:07'),
(163, 'Nguyễn Hải Đăng', 2691, 2, 'active', NULL, '2026-03-10 01:31:07'),
(164, 'Hoàng Thanh Trúc', 2705, 2, 'active', NULL, '2026-03-10 01:31:07'),
(165, 'Mai Xuân Trường', 2720, 2, 'active', NULL, '2026-03-10 01:31:07'),
(166, 'Phan Bích Diệp', 2736, 2, 'active', NULL, '2026-03-10 01:31:07'),
(167, 'Hồ Sỹ Hùng', 2753, 2, 'active', NULL, '2026-03-10 01:31:07'),
(168, 'Cao Minh Tuyết', 2771, 2, 'active', NULL, '2026-03-10 01:31:07'),
(169, 'Dương Quốc Anh', 2790, 2, 'active', NULL, '2026-03-10 01:31:07'),
(170, 'Đinh Công Thành', 2810, 2, 'active', NULL, '2026-03-10 01:31:07'),
(171, 'Quách Ngọc Hải', 2831, 2, 'active', NULL, '2026-03-10 01:31:07'),
(172, 'Trần Đức Bo', 2853, 2, 'active', NULL, '2026-03-10 01:31:07'),
(173, 'Lê Thị Thắm', 2876, 2, 'active', NULL, '2026-03-10 01:31:07'),
(174, 'Phạm Hồng Sơn', 2900, 2, 'active', NULL, '2026-03-10 01:31:07'),
(175, 'Nguyễn Bích Phương', 2925, 2, 'active', NULL, '2026-03-10 01:31:07'),
(176, 'Lương Gia Huy', 2951, 2, 'active', NULL, '2026-03-10 01:31:07'),
(177, 'Võ Hoàng Yến', 2978, 2, 'active', NULL, '2026-03-10 01:31:07'),
(178, 'Tạ Minh Tâm', 3006, 2, 'active', NULL, '2026-03-10 01:31:07'),
(179, 'Diệp Bảo Ngọc', 3035, 2, 'active', NULL, '2026-03-10 01:31:07'),
(180, 'Phan Thanh Bình', 3065, 2, 'active', NULL, '2026-03-10 01:31:07'),
(181, 'Nguyễn Hữu Thắng', 3096, 2, 'active', NULL, '2026-03-10 01:31:07'),
(182, 'Trần Minh Vương', 3128, 2, 'active', NULL, '2026-03-10 01:31:07'),
(183, 'Lê Văn Xuân', 3161, 2, 'active', NULL, '2026-03-10 01:31:07'),
(184, 'Phạm Tuấn Hải', 3195, 2, 'active', NULL, '2026-03-10 01:31:07'),
(185, 'Nguyễn Quang Hải', 3230, 2, 'active', NULL, '2026-03-10 01:31:07'),
(186, 'Đỗ Hùng Dũng', 3266, 2, 'active', NULL, '2026-03-10 01:31:07'),
(187, 'Quế Ngọc Hải', 3303, 2, 'active', NULL, '2026-03-10 01:31:07'),
(188, 'Nguyễn Tiến Linh', 3341, 2, 'active', NULL, '2026-03-10 01:31:07'),
(189, 'Bùi Tiến Dũng', 3380, 2, 'active', NULL, '2026-03-10 01:31:07'),
(190, 'Đặng Văn Lâm', 3420, 2, 'active', NULL, '2026-03-10 01:31:07'),
(191, 'Nguyễn Phong Hồng Duy', 3461, 2, 'active', NULL, '2026-03-10 01:31:07'),
(192, 'Vũ Văn Thanh', 3503, 2, 'active', NULL, '2026-03-10 01:31:07'),
(193, 'Lương Xuân Trường', 3546, 2, 'active', NULL, '2026-03-10 01:31:07'),
(194, 'Nguyễn Tuấn Anh', 3590, 2, 'active', NULL, '2026-03-10 01:31:07'),
(195, 'Phạm Đức Huy', 3635, 2, 'active', NULL, '2026-03-10 01:31:07'),
(196, 'Trần Đình Trọng', 3681, 2, 'active', NULL, '2026-03-10 01:31:07'),
(197, 'Đỗ Duy Mạnh', 3728, 2, 'active', NULL, '2026-03-10 01:31:07'),
(198, 'Nguyễn Thành Chung', 3776, 2, 'active', NULL, '2026-03-10 01:31:07'),
(199, 'Đoàn Văn Hậu', 3825, 2, 'active', NULL, '2026-03-10 01:31:07'),
(200, 'Hồ Tấn Tài', 3875, 2, 'active', NULL, '2026-03-10 01:31:07');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `contests`
--

CREATE TABLE `contests` (
  `id` int(11) NOT NULL,
  `title` varchar(200) NOT NULL,
  `description` text DEFAULT NULL,
  `created_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Đang đổ dữ liệu cho bảng `contests`
--

INSERT INTO `contests` (`id`, `title`, `description`, `created_at`) VALUES
(1, 'Kiến thức', '', '2026-03-10 00:52:31'),
(2, 'Rung Chuông', '', '2026-03-10 01:07:56');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `questions`
--

CREATE TABLE `questions` (
  `id` int(11) NOT NULL,
  `contest_id` int(11) NOT NULL,
  `order_index` int(11) NOT NULL,
  `text` text NOT NULL,
  `option_a` varchar(500) NOT NULL,
  `option_b` varchar(500) NOT NULL,
  `option_c` varchar(500) NOT NULL,
  `option_d` varchar(500) NOT NULL,
  `correct_answer` varchar(1) NOT NULL,
  `time_limit_sec` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Đang đổ dữ liệu cho bảng `questions`
--

INSERT INTO `questions` (`id`, `contest_id`, `order_index`, `text`, `option_a`, `option_b`, `option_c`, `option_d`, `correct_answer`, `time_limit_sec`) VALUES
(1, 1, 0, 'Công an là gì', 'Cảnh sát', 'Tham mưu', 'An ninh', 'Tất cả', 'D', 30),
(2, 2, 0, 'Chào', 'A', 'B', 'C', 'D', 'B', 30);

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `responses`
--

CREATE TABLE `responses` (
  `id` int(11) NOT NULL,
  `session_id` int(11) NOT NULL,
  `contestant_id` int(11) NOT NULL,
  `question_id` int(11) NOT NULL,
  `answer` varchar(1) NOT NULL,
  `scanned_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `sessions`
--

CREATE TABLE `sessions` (
  `id` int(11) NOT NULL,
  `contest_id` int(11) NOT NULL,
  `state` enum('waiting','scanning','revealed','ended') NOT NULL,
  `current_question_index` int(11) DEFAULT NULL,
  `started_at` datetime DEFAULT NULL,
  `ended_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Đang đổ dữ liệu cho bảng `sessions`
--

INSERT INTO `sessions` (`id`, `contest_id`, `state`, `current_question_index`, `started_at`, `ended_at`) VALUES
(1, 1, 'ended', 0, '2026-03-10 01:11:46', '2026-03-10 01:17:31'),
(2, 2, 'ended', 0, '2026-03-10 01:27:51', '2026-03-10 01:27:55');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `session_logs`
--

CREATE TABLE `session_logs` (
  `id` int(11) NOT NULL,
  `session_id` int(11) NOT NULL,
  `event_type` enum('session_started','question_opened','answer_scanned','answer_revealed','contestants_eliminated','session_ended','btc_override') NOT NULL,
  `event_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`event_data`)),
  `occurred_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Đang đổ dữ liệu cho bảng `session_logs`
--

INSERT INTO `session_logs` (`id`, `session_id`, `event_type`, `event_data`, `occurred_at`) VALUES
(1, 1, 'session_started', '{\"contest_id\": 1}', '2026-03-10 01:11:46'),
(2, 1, 'question_opened', '{\"question_index\": 0, \"question_id\": 1}', '2026-03-10 01:11:46'),
(3, 1, 'session_ended', '{\"winners\": [{\"id\": 51, \"name\": \"Nguy\\u1ec5n V\\u0103n An\", \"card_id\": 51}, {\"id\": 52, \"name\": \"Tr\\u1ea7n Th\\u1ecb B\\u00ecnh\", \"card_id\": 53}, {\"id\": 53, \"name\": \"L\\u00ea Ho\\u00e0ng Nam\", \"card_id\": 56}, {\"id\": 54, \"name\": \"Ph\\u1ea1m Minh \\u0110\\u1ee9c\", \"card_id\": 60}, {\"id\": 55, \"name\": \"V\\u0169 Thu Th\\u1ea3o\", \"card_id\": 65}, {\"id\": 56, \"name\": \"\\u0110\\u1eb7ng H\\u00f9ng D\\u0169ng\", \"card_id\": 71}, {\"id\": 57, \"name\": \"Ng\\u00f4 B\\u1ea3o Ch\\u00e2u\", \"card_id\": 78}, {\"id\": 58, \"name\": \"\\u0110\\u1ed7 Th\\u00f9y Linh\", \"card_id\": 86}, {\"id\": 59, \"name\": \"B\\u00f9i Anh Tu\\u1ea5n\", \"card_id\": 95}, {\"id\": 60, \"name\": \"L\\u00fd Gia H\\u00e2n\", \"card_id\": 105}, {\"id\": 61, \"name\": \"Chu Quang Kh\\u1ea3i\", \"card_id\": 116}, {\"id\": 62, \"name\": \"Tr\\u1ecbnh Kim Chi\", \"card_id\": 128}, {\"id\": 63, \"name\": \"Nguy\\u1ec5n H\\u1ea3i \\u0110\\u0103ng\", \"card_id\": 141}, {\"id\": 64, \"name\": \"Ho\\u00e0ng Thanh Tr\\u00fac\", \"card_id\": 155}, {\"id\": 65, \"name\": \"Mai Xu\\u00e2n Tr\\u01b0\\u1eddng\", \"card_id\": 170}, {\"id\": 66, \"name\": \"Phan B\\u00edch Di\\u1ec7p\", \"card_id\": 186}, {\"id\": 67, \"name\": \"H\\u1ed3 S\\u1ef9 H\\u00f9ng\", \"card_id\": 203}, {\"id\": 68, \"name\": \"Cao Minh Tuy\\u1ebft\", \"card_id\": 221}, {\"id\": 69, \"name\": \"D\\u01b0\\u01a1ng Qu\\u1ed1c Anh\", \"card_id\": 240}, {\"id\": 70, \"name\": \"\\u0110inh C\\u00f4ng Th\\u00e0nh\", \"card_id\": 260}, {\"id\": 71, \"name\": \"Qu\\u00e1ch Ng\\u1ecdc H\\u1ea3i\", \"card_id\": 281}, {\"id\": 72, \"name\": \"Tr\\u1ea7n \\u0110\\u1ee9c Bo\", \"card_id\": 303}, {\"id\": 73, \"name\": \"L\\u00ea Th\\u1ecb Th\\u1eafm\", \"card_id\": 326}, {\"id\": 74, \"name\": \"Ph\\u1ea1m H\\u1ed3ng S\\u01a1n\", \"card_id\": 350}, {\"id\": 75, \"name\": \"Nguy\\u1ec5n B\\u00edch Ph\\u01b0\\u01a1ng\", \"card_id\": 375}, {\"id\": 76, \"name\": \"L\\u01b0\\u01a1ng Gia Huy\", \"card_id\": 401}, {\"id\": 77, \"name\": \"V\\u00f5 Ho\\u00e0ng Y\\u1ebfn\", \"card_id\": 428}, {\"id\": 78, \"name\": \"T\\u1ea1 Minh T\\u00e2m\", \"card_id\": 456}, {\"id\": 79, \"name\": \"Di\\u1ec7p B\\u1ea3o Ng\\u1ecdc\", \"card_id\": 485}, {\"id\": 80, \"name\": \"Phan Thanh B\\u00ecnh\", \"card_id\": 515}, {\"id\": 81, \"name\": \"Nguy\\u1ec5n H\\u1eefu Th\\u1eafng\", \"card_id\": 546}, {\"id\": 82, \"name\": \"Tr\\u1ea7n Minh V\\u01b0\\u01a1ng\", \"card_id\": 578}, {\"id\": 83, \"name\": \"L\\u00ea V\\u0103n Xu\\u00e2n\", \"card_id\": 611}, {\"id\": 84, \"name\": \"Ph\\u1ea1m Tu\\u1ea5n H\\u1ea3i\", \"card_id\": 645}, {\"id\": 85, \"name\": \"Nguy\\u1ec5n Quang H\\u1ea3i\", \"card_id\": 680}, {\"id\": 86, \"name\": \"\\u0110\\u1ed7 H\\u00f9ng D\\u0169ng\", \"card_id\": 716}, {\"id\": 87, \"name\": \"Qu\\u1ebf Ng\\u1ecdc H\\u1ea3i\", \"card_id\": 753}, {\"id\": 88, \"name\": \"Nguy\\u1ec5n Ti\\u1ebfn Linh\", \"card_id\": 791}, {\"id\": 89, \"name\": \"B\\u00f9i Ti\\u1ebfn D\\u0169ng\", \"card_id\": 830}, {\"id\": 90, \"name\": \"\\u0110\\u1eb7ng V\\u0103n L\\u00e2m\", \"card_id\": 870}, {\"id\": 91, \"name\": \"Nguy\\u1ec5n Phong H\\u1ed3ng Duy\", \"card_id\": 911}, {\"id\": 92, \"name\": \"V\\u0169 V\\u0103n Thanh\", \"card_id\": 953}, {\"id\": 93, \"name\": \"L\\u01b0\\u01a1ng Xu\\u00e2n Tr\\u01b0\\u1eddng\", \"card_id\": 996}, {\"id\": 94, \"name\": \"Nguy\\u1ec5n Tu\\u1ea5n Anh\", \"card_id\": 1040}, {\"id\": 95, \"name\": \"Ph\\u1ea1m \\u0110\\u1ee9c Huy\", \"card_id\": 1085}, {\"id\": 96, \"name\": \"Tr\\u1ea7n \\u0110\\u00ecnh Tr\\u1ecdng\", \"card_id\": 1131}, {\"id\": 97, \"name\": \"\\u0110\\u1ed7 Duy M\\u1ea1nh\", \"card_id\": 1178}, {\"id\": 98, \"name\": \"Nguy\\u1ec5n Th\\u00e0nh Chung\", \"card_id\": 1226}, {\"id\": 99, \"name\": \"\\u0110o\\u00e0n V\\u0103n H\\u1eadu\", \"card_id\": 1275}, {\"id\": 100, \"name\": \"H\\u1ed3 T\\u1ea5n T\\u00e0i\", \"card_id\": 1325}]}', '2026-03-10 01:17:31'),
(4, 2, 'session_started', '{\"contest_id\": 2}', '2026-03-10 01:27:51'),
(5, 2, 'question_opened', '{\"question_index\": 0, \"question_id\": 2}', '2026-03-10 01:27:51'),
(6, 2, 'session_ended', '{\"winners\": [{\"id\": 1, \"name\": \"Nguy\\u1ec5n V\\u0103n An\", \"card_id\": 1}, {\"id\": 2, \"name\": \"Tr\\u1ea7n Th\\u1ecb B\\u00ecnh\", \"card_id\": 2}, {\"id\": 3, \"name\": \"L\\u00ea Ho\\u00e0ng Nam\", \"card_id\": 3}, {\"id\": 4, \"name\": \"Ph\\u1ea1m Minh \\u0110\\u1ee9c\", \"card_id\": 4}, {\"id\": 5, \"name\": \"V\\u0169 Thu Th\\u1ea3o\", \"card_id\": 5}, {\"id\": 6, \"name\": \"\\u0110\\u1eb7ng H\\u00f9ng D\\u0169ng\", \"card_id\": 6}, {\"id\": 7, \"name\": \"Ng\\u00f4 B\\u1ea3o Ch\\u00e2u\", \"card_id\": 7}, {\"id\": 8, \"name\": \"\\u0110\\u1ed7 Th\\u00f9y Linh\", \"card_id\": 8}, {\"id\": 9, \"name\": \"B\\u00f9i Anh Tu\\u1ea5n\", \"card_id\": 9}, {\"id\": 10, \"name\": \"L\\u00fd Gia H\\u00e2n\", \"card_id\": 10}, {\"id\": 11, \"name\": \"Chu Quang Kh\\u1ea3i\", \"card_id\": 11}, {\"id\": 12, \"name\": \"Tr\\u1ecbnh Kim Chi\", \"card_id\": 12}, {\"id\": 13, \"name\": \"Nguy\\u1ec5n H\\u1ea3i \\u0110\\u0103ng\", \"card_id\": 13}, {\"id\": 14, \"name\": \"Ho\\u00e0ng Thanh Tr\\u00fac\", \"card_id\": 14}, {\"id\": 15, \"name\": \"Mai Xu\\u00e2n Tr\\u01b0\\u1eddng\", \"card_id\": 15}, {\"id\": 16, \"name\": \"Phan B\\u00edch Di\\u1ec7p\", \"card_id\": 16}, {\"id\": 17, \"name\": \"H\\u1ed3 S\\u1ef9 H\\u00f9ng\", \"card_id\": 17}, {\"id\": 18, \"name\": \"Cao Minh Tuy\\u1ebft\", \"card_id\": 18}, {\"id\": 19, \"name\": \"D\\u01b0\\u01a1ng Qu\\u1ed1c Anh\", \"card_id\": 19}, {\"id\": 20, \"name\": \"\\u0110inh C\\u00f4ng Th\\u00e0nh\", \"card_id\": 20}, {\"id\": 21, \"name\": \"Qu\\u00e1ch Ng\\u1ecdc H\\u1ea3i\", \"card_id\": 21}, {\"id\": 22, \"name\": \"Tr\\u1ea7n \\u0110\\u1ee9c Bo\", \"card_id\": 22}, {\"id\": 23, \"name\": \"L\\u00ea Th\\u1ecb Th\\u1eafm\", \"card_id\": 23}, {\"id\": 24, \"name\": \"Ph\\u1ea1m H\\u1ed3ng S\\u01a1n\", \"card_id\": 24}, {\"id\": 25, \"name\": \"Nguy\\u1ec5n B\\u00edch Ph\\u01b0\\u01a1ng\", \"card_id\": 25}, {\"id\": 26, \"name\": \"L\\u01b0\\u01a1ng Gia Huy\", \"card_id\": 26}, {\"id\": 27, \"name\": \"V\\u00f5 Ho\\u00e0ng Y\\u1ebfn\", \"card_id\": 27}, {\"id\": 28, \"name\": \"T\\u1ea1 Minh T\\u00e2m\", \"card_id\": 28}, {\"id\": 29, \"name\": \"Di\\u1ec7p B\\u1ea3o Ng\\u1ecdc\", \"card_id\": 29}, {\"id\": 30, \"name\": \"Phan Thanh B\\u00ecnh\", \"card_id\": 30}, {\"id\": 31, \"name\": \"Nguy\\u1ec5n H\\u1eefu Th\\u1eafng\", \"card_id\": 31}, {\"id\": 32, \"name\": \"Tr\\u1ea7n Minh V\\u01b0\\u01a1ng\", \"card_id\": 32}, {\"id\": 33, \"name\": \"L\\u00ea V\\u0103n Xu\\u00e2n\", \"card_id\": 33}, {\"id\": 34, \"name\": \"Ph\\u1ea1m Tu\\u1ea5n H\\u1ea3i\", \"card_id\": 34}, {\"id\": 35, \"name\": \"Nguy\\u1ec5n Quang H\\u1ea3i\", \"card_id\": 35}, {\"id\": 36, \"name\": \"\\u0110\\u1ed7 H\\u00f9ng D\\u0169ng\", \"card_id\": 36}, {\"id\": 37, \"name\": \"Qu\\u1ebf Ng\\u1ecdc H\\u1ea3i\", \"card_id\": 37}, {\"id\": 38, \"name\": \"Nguy\\u1ec5n Ti\\u1ebfn Linh\", \"card_id\": 38}, {\"id\": 39, \"name\": \"B\\u00f9i Ti\\u1ebfn D\\u0169ng\", \"card_id\": 39}, {\"id\": 40, \"name\": \"\\u0110\\u1eb7ng V\\u0103n L\\u00e2m\", \"card_id\": 40}, {\"id\": 41, \"name\": \"Nguy\\u1ec5n Phong H\\u1ed3ng Duy\", \"card_id\": 41}, {\"id\": 42, \"name\": \"V\\u0169 V\\u0103n Thanh\", \"card_id\": 42}, {\"id\": 43, \"name\": \"L\\u01b0\\u01a1ng Xu\\u00e2n Tr\\u01b0\\u1eddng\", \"card_id\": 43}, {\"id\": 44, \"name\": \"Nguy\\u1ec5n Tu\\u1ea5n Anh\", \"card_id\": 44}, {\"id\": 45, \"name\": \"Ph\\u1ea1m \\u0110\\u1ee9c Huy\", \"card_id\": 45}, {\"id\": 46, \"name\": \"Tr\\u1ea7n \\u0110\\u00ecnh Tr\\u1ecdng\", \"card_id\": 46}, {\"id\": 47, \"name\": \"\\u0110\\u1ed7 Duy M\\u1ea1nh\", \"card_id\": 47}, {\"id\": 48, \"name\": \"Nguy\\u1ec5n Th\\u00e0nh Chung\", \"card_id\": 48}, {\"id\": 49, \"name\": \"\\u0110o\\u00e0n V\\u0103n H\\u1eadu\", \"card_id\": 49}, {\"id\": 50, \"name\": \"H\\u1ed3 T\\u1ea5n T\\u00e0i\", \"card_id\": 50}, {\"id\": 101, \"name\": \"Nguy\\u1ec5n V\\u0103n An\", \"card_id\": 1326}, {\"id\": 102, \"name\": \"Tr\\u1ea7n Th\\u1ecb B\\u00ecnh\", \"card_id\": 1328}, {\"id\": 103, \"name\": \"L\\u00ea Ho\\u00e0ng Nam\", \"card_id\": 1331}, {\"id\": 104, \"name\": \"Ph\\u1ea1m Minh \\u0110\\u1ee9c\", \"card_id\": 1335}, {\"id\": 105, \"name\": \"V\\u0169 Thu Th\\u1ea3o\", \"card_id\": 1340}, {\"id\": 106, \"name\": \"\\u0110\\u1eb7ng H\\u00f9ng D\\u0169ng\", \"card_id\": 1346}, {\"id\": 107, \"name\": \"Ng\\u00f4 B\\u1ea3o Ch\\u00e2u\", \"card_id\": 1353}, {\"id\": 108, \"name\": \"\\u0110\\u1ed7 Th\\u00f9y Linh\", \"card_id\": 1361}, {\"id\": 109, \"name\": \"B\\u00f9i Anh Tu\\u1ea5n\", \"card_id\": 1370}, {\"id\": 110, \"name\": \"L\\u00fd Gia H\\u00e2n\", \"card_id\": 1380}, {\"id\": 111, \"name\": \"Chu Quang Kh\\u1ea3i\", \"card_id\": 1391}, {\"id\": 112, \"name\": \"Tr\\u1ecbnh Kim Chi\", \"card_id\": 1403}, {\"id\": 113, \"name\": \"Nguy\\u1ec5n H\\u1ea3i \\u0110\\u0103ng\", \"card_id\": 1416}, {\"id\": 114, \"name\": \"Ho\\u00e0ng Thanh Tr\\u00fac\", \"card_id\": 1430}, {\"id\": 115, \"name\": \"Mai Xu\\u00e2n Tr\\u01b0\\u1eddng\", \"card_id\": 1445}, {\"id\": 116, \"name\": \"Phan B\\u00edch Di\\u1ec7p\", \"card_id\": 1461}, {\"id\": 117, \"name\": \"H\\u1ed3 S\\u1ef9 H\\u00f9ng\", \"card_id\": 1478}, {\"id\": 118, \"name\": \"Cao Minh Tuy\\u1ebft\", \"card_id\": 1496}, {\"id\": 119, \"name\": \"D\\u01b0\\u01a1ng Qu\\u1ed1c Anh\", \"card_id\": 1515}, {\"id\": 120, \"name\": \"\\u0110inh C\\u00f4ng Th\\u00e0nh\", \"card_id\": 1535}, {\"id\": 121, \"name\": \"Qu\\u00e1ch Ng\\u1ecdc H\\u1ea3i\", \"card_id\": 1556}, {\"id\": 122, \"name\": \"Tr\\u1ea7n \\u0110\\u1ee9c Bo\", \"card_id\": 1578}, {\"id\": 123, \"name\": \"L\\u00ea Th\\u1ecb Th\\u1eafm\", \"card_id\": 1601}, {\"id\": 124, \"name\": \"Ph\\u1ea1m H\\u1ed3ng S\\u01a1n\", \"card_id\": 1625}, {\"id\": 125, \"name\": \"Nguy\\u1ec5n B\\u00edch Ph\\u01b0\\u01a1ng\", \"card_id\": 1650}, {\"id\": 126, \"name\": \"L\\u01b0\\u01a1ng Gia Huy\", \"card_id\": 1676}, {\"id\": 127, \"name\": \"V\\u00f5 Ho\\u00e0ng Y\\u1ebfn\", \"card_id\": 1703}, {\"id\": 128, \"name\": \"T\\u1ea1 Minh T\\u00e2m\", \"card_id\": 1731}, {\"id\": 129, \"name\": \"Di\\u1ec7p B\\u1ea3o Ng\\u1ecdc\", \"card_id\": 1760}, {\"id\": 130, \"name\": \"Phan Thanh B\\u00ecnh\", \"card_id\": 1790}, {\"id\": 131, \"name\": \"Nguy\\u1ec5n H\\u1eefu Th\\u1eafng\", \"card_id\": 1821}, {\"id\": 132, \"name\": \"Tr\\u1ea7n Minh V\\u01b0\\u01a1ng\", \"card_id\": 1853}, {\"id\": 133, \"name\": \"L\\u00ea V\\u0103n Xu\\u00e2n\", \"card_id\": 1886}, {\"id\": 134, \"name\": \"Ph\\u1ea1m Tu\\u1ea5n H\\u1ea3i\", \"card_id\": 1920}, {\"id\": 135, \"name\": \"Nguy\\u1ec5n Quang H\\u1ea3i\", \"card_id\": 1955}, {\"id\": 136, \"name\": \"\\u0110\\u1ed7 H\\u00f9ng D\\u0169ng\", \"card_id\": 1991}, {\"id\": 137, \"name\": \"Qu\\u1ebf Ng\\u1ecdc H\\u1ea3i\", \"card_id\": 2028}, {\"id\": 138, \"name\": \"Nguy\\u1ec5n Ti\\u1ebfn Linh\", \"card_id\": 2066}, {\"id\": 139, \"name\": \"B\\u00f9i Ti\\u1ebfn D\\u0169ng\", \"card_id\": 2105}, {\"id\": 140, \"name\": \"\\u0110\\u1eb7ng V\\u0103n L\\u00e2m\", \"card_id\": 2145}, {\"id\": 141, \"name\": \"Nguy\\u1ec5n Phong H\\u1ed3ng Duy\", \"card_id\": 2186}, {\"id\": 142, \"name\": \"V\\u0169 V\\u0103n Thanh\", \"card_id\": 2228}, {\"id\": 143, \"name\": \"L\\u01b0\\u01a1ng Xu\\u00e2n Tr\\u01b0\\u1eddng\", \"card_id\": 2271}, {\"id\": 144, \"name\": \"Nguy\\u1ec5n Tu\\u1ea5n Anh\", \"card_id\": 2315}, {\"id\": 145, \"name\": \"Ph\\u1ea1m \\u0110\\u1ee9c Huy\", \"card_id\": 2360}, {\"id\": 146, \"name\": \"Tr\\u1ea7n \\u0110\\u00ecnh Tr\\u1ecdng\", \"card_id\": 2406}, {\"id\": 147, \"name\": \"\\u0110\\u1ed7 Duy M\\u1ea1nh\", \"card_id\": 2453}, {\"id\": 148, \"name\": \"Nguy\\u1ec5n Th\\u00e0nh Chung\", \"card_id\": 2501}, {\"id\": 149, \"name\": \"\\u0110o\\u00e0n V\\u0103n H\\u1eadu\", \"card_id\": 2550}, {\"id\": 150, \"name\": \"H\\u1ed3 T\\u1ea5n T\\u00e0i\", \"card_id\": 2600}]}', '2026-03-10 01:27:55');

--
-- Chỉ mục cho các bảng đã đổ
--

--
-- Chỉ mục cho bảng `contestants`
--
ALTER TABLE `contestants`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `ix_contestants_card_id` (`card_id`),
  ADD KEY `contest_id` (`contest_id`),
  ADD KEY `ix_contestants_id` (`id`),
  ADD KEY `ix_contestants_status` (`status`),
  ADD KEY `ix_contestants_name` (`name`);

--
-- Chỉ mục cho bảng `contests`
--
ALTER TABLE `contests`
  ADD PRIMARY KEY (`id`),
  ADD KEY `ix_contests_id` (`id`),
  ADD KEY `ix_contests_title` (`title`);

--
-- Chỉ mục cho bảng `questions`
--
ALTER TABLE `questions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `contest_id` (`contest_id`),
  ADD KEY `ix_questions_id` (`id`);

--
-- Chỉ mục cho bảng `responses`
--
ALTER TABLE `responses`
  ADD PRIMARY KEY (`id`),
  ADD KEY `session_id` (`session_id`),
  ADD KEY `contestant_id` (`contestant_id`),
  ADD KEY `question_id` (`question_id`),
  ADD KEY `ix_responses_id` (`id`);

--
-- Chỉ mục cho bảng `sessions`
--
ALTER TABLE `sessions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `contest_id` (`contest_id`),
  ADD KEY `ix_sessions_id` (`id`),
  ADD KEY `ix_sessions_state` (`state`);

--
-- Chỉ mục cho bảng `session_logs`
--
ALTER TABLE `session_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `session_id` (`session_id`),
  ADD KEY `ix_session_logs_id` (`id`);

--
-- AUTO_INCREMENT cho các bảng đã đổ
--

--
-- AUTO_INCREMENT cho bảng `contestants`
--
ALTER TABLE `contestants`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=201;

--
-- AUTO_INCREMENT cho bảng `contests`
--
ALTER TABLE `contests`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT cho bảng `questions`
--
ALTER TABLE `questions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT cho bảng `responses`
--
ALTER TABLE `responses`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT cho bảng `sessions`
--
ALTER TABLE `sessions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT cho bảng `session_logs`
--
ALTER TABLE `session_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- Các ràng buộc cho các bảng đã đổ
--

--
-- Các ràng buộc cho bảng `contestants`
--
ALTER TABLE `contestants`
  ADD CONSTRAINT `contestants_ibfk_1` FOREIGN KEY (`contest_id`) REFERENCES `contests` (`id`);

--
-- Các ràng buộc cho bảng `questions`
--
ALTER TABLE `questions`
  ADD CONSTRAINT `questions_ibfk_1` FOREIGN KEY (`contest_id`) REFERENCES `contests` (`id`);

--
-- Các ràng buộc cho bảng `responses`
--
ALTER TABLE `responses`
  ADD CONSTRAINT `responses_ibfk_1` FOREIGN KEY (`session_id`) REFERENCES `sessions` (`id`),
  ADD CONSTRAINT `responses_ibfk_2` FOREIGN KEY (`contestant_id`) REFERENCES `contestants` (`id`),
  ADD CONSTRAINT `responses_ibfk_3` FOREIGN KEY (`question_id`) REFERENCES `questions` (`id`);

--
-- Các ràng buộc cho bảng `sessions`
--
ALTER TABLE `sessions`
  ADD CONSTRAINT `sessions_ibfk_1` FOREIGN KEY (`contest_id`) REFERENCES `contests` (`id`);

--
-- Các ràng buộc cho bảng `session_logs`
--
ALTER TABLE `session_logs`
  ADD CONSTRAINT `session_logs_ibfk_1` FOREIGN KEY (`session_id`) REFERENCES `sessions` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

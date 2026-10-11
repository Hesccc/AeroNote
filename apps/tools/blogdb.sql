/*
SQLyog Ultimate v12.08 (64 bit)
MySQL - 8.2.0 : Database - blogdb
*********************************************************************
*/


/*!40101 SET NAMES utf8 */;

/*!40101 SET SQL_MODE=''*/;

/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
CREATE DATABASE /*!32312 IF NOT EXISTS*/`blogdb` /*!40100 DEFAULT CHARACTER SET utf8mb3 COLLATE utf8mb3_bin */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `blogdb`;

/*Table structure for table `categories` */

DROP TABLE IF EXISTS `categories`;

CREATE TABLE `categories` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '最后修改时间',
  `description` varchar(100) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin DEFAULT NULL COMMENT '分类描述',
  `name` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL COMMENT '分类名称',
  `parent_id` int DEFAULT '0' COMMENT '父分类ID',
  `password` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin DEFAULT NULL COMMENT '分类密码',
  `priority` int DEFAULT '0' COMMENT '分类优先级',
  `slug` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL COMMENT '简称ID',
  `slug_name` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin DEFAULT NULL COMMENT '简称名称',
  `thumbnail` varchar(1023) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin DEFAULT NULL COMMENT '缩略图',
  `deleted` int NOT NULL DEFAULT '0' COMMENT '删除状态，0=启动;1=删除',
  `color` varchar(255) CHARACTER SET utf16 COLLATE utf16_general_ci NOT NULL DEFAULT '#41baff' COMMENT '分类颜色',
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_oul14ho7bctbefv8jywp5v3i2` (`slug`),
  KEY `categories_name` (`name`),
  KEY `categories_parent_id` (`parent_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf16;

/*Data for the table `categories` */

LOCK TABLES `categories` WRITE;

insert  into `categories`(`id`,`create_time`,`update_time`,`description`,`name`,`parent_id`,`password`,`priority`,`slug`,`slug_name`,`thumbnail`,`deleted`,`color`) values (1,'2024-01-06 22:13:25','2024-01-06 22:13:25','这是你的默认分类，如不需要，删除即可。','默认分类',0,NULL,0,'default',NULL,'',0,'#41baff'),(2,'2024-01-07 11:33:41','2024-01-07 03:34:09','Oracle','Oracle',0,NULL,0,'oracle',NULL,'',0,'#41baff'),(3,'2024-01-07 03:34:39','2024-01-07 03:34:39','Splunk分类','Splunk',0,NULL,0,'splunk',NULL,'',0,'#41baff');

UNLOCK TABLES;

/*Table structure for table `config` */

DROP TABLE IF EXISTS `config`;

CREATE TABLE `config` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '参数名称',
  `value` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '无' COMMENT '参数值',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/*Data for the table `config` */

LOCK TABLES `config` WRITE;

insert  into `config`(`id`,`name`,`value`) values (1,'website_url','https://example.com'),(2,'website_title','AeroNote'),(3,'website_keywords','博客;技术笔记;数字花园;工程实践'),(4,'website_desc','记录技术实践与工程思考，于碎片化网络中保持专注与沉淀'),(5,'website_icp','');

UNLOCK TABLES;

/*Table structure for table `history` */

DROP TABLE IF EXISTS `history`;

CREATE TABLE `history` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '日志ID',
  `username` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '日志操作用户',
  `time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '日志发生时间',
  `type` varchar(50) DEFAULT NULL COMMENT '日志类型,1=登入＆2=登出',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/*Data for the table `history` */

LOCK TABLES `history` WRITE;

insert  into `history`(`id`,`username`,`time`,`type`) values (1,'admin','2024-01-06 18:07:42','login'),(2,'admin','2024-01-06 18:09:03','login'),(3,'admin','2024-01-06 18:30:24','login'),(4,'admin','2024-01-06 18:39:38','login'),(5,'admin','2024-01-06 18:41:28','login'),(6,'admin','2024-01-06 19:05:48','login'),(7,'admin','2024-01-06 20:21:53','login'),(8,'admin','2024-01-06 21:18:39','logout'),(9,'admin','2024-01-06 21:18:52','login'),(10,'admin','2024-01-06 21:19:41','logout'),(11,'admin','2024-01-06 21:23:43','login'),(12,'admin','2024-01-06 23:06:22','login'),(13,'admin','2024-01-07 11:13:49','login'),(14,'admin','2024-01-07 16:14:45','login');

UNLOCK TABLES;

/*Table structure for table `post_categories` */

DROP TABLE IF EXISTS `post_categories`;

CREATE TABLE `post_categories` (
  `id` tinyint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `deleted` tinyint DEFAULT '0' COMMENT '删除状态，0=启用;1=删除',
  `update_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '最后修改时间',
  `category_id` tinyint DEFAULT NULL COMMENT '分类ID',
  `post_id` tinyint DEFAULT NULL COMMENT '文章ID',
  PRIMARY KEY (`id`),
  KEY `post_categories_post_id` (`post_id`),
  KEY `post_categories_category_id` (`category_id`)
) ENGINE=MyISAM AUTO_INCREMENT=997 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*Data for the table `post_categories` */

LOCK TABLES `post_categories` WRITE;

insert  into `post_categories`(`id`,`create_time`,`deleted`,`update_time`,`category_id`,`post_id`) values (1,'2024-01-06 22:59:37',0,'2024-01-06 22:59:45',1,1),(2,'2024-01-07 03:35:38',0,'2024-01-07 03:35:38',2,1),(3,'2024-01-07 03:35:42',0,'2024-01-07 03:35:42',3,1),(4,'2024-01-07 03:39:49',0,'2024-01-07 03:39:49',1,2),(5,'2024-01-07 03:39:52',0,'2024-01-07 03:39:52',2,2);

UNLOCK TABLES;

/*Table structure for table `post_tags` */

DROP TABLE IF EXISTS `post_tags`;

CREATE TABLE `post_tags` (
  `id` tinyint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `deleted` tinyint DEFAULT '0' COMMENT '删除状态，0=启动;1=删除',
  `update_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '最后修改时间',
  `post_id` tinyint NOT NULL COMMENT '文章ID',
  `tag_id` tinyint NOT NULL COMMENT '标签ID',
  PRIMARY KEY (`id`),
  KEY `post_tags_post_id` (`post_id`),
  KEY `post_tags_tag_id` (`tag_id`)
) ENGINE=MyISAM AUTO_INCREMENT=1555 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*Data for the table `post_tags` */

LOCK TABLES `post_tags` WRITE;

insert  into `post_tags`(`id`,`create_time`,`deleted`,`update_time`,`post_id`,`tag_id`) values (1,'2023-09-01 00:36:40',0,'2023-09-01 00:36:40',1,1),(5,'2024-01-07 03:38:58',0,'2024-01-07 03:38:58',2,2),(4,'2024-01-07 03:38:54',0,'2024-01-07 03:38:54',2,1),(3,'2024-01-07 03:38:07',0,'2024-01-07 03:38:07',1,3),(2,'2024-01-07 03:38:02',0,'2024-01-07 03:38:02',1,2);

UNLOCK TABLES;

/*Table structure for table `posts` */

DROP TABLE IF EXISTS `posts`;

CREATE TABLE `posts` (
  `id` int unsigned NOT NULL AUTO_INCREMENT COMMENT '文章主键',
  `title` varchar(200) DEFAULT NULL COMMENT '文章标题',
  `author` varchar(200) DEFAULT NULL COMMENT '文章作者',
  `content` text COMMENT '文章内容',
  `access_count` int DEFAULT '0' COMMENT '文章访问次数',
  `thumbnail` varchar(20) DEFAULT NULL COMMENT '文章缩略图',
  `status` int DEFAULT '0' COMMENT '文章状态,0:已发布,1:审核中,2:编辑中,3:草稿',
  `update_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '最后修改时间',
  `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '文章新增时间',
  `meta_description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci COMMENT '缩略图',
  `deleted` int DEFAULT '0' COMMENT '删除状态，0=启用;1=删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/*Data for the table `posts` */

LOCK TABLES `posts` WRITE;

insert  into `posts`(`id`,`title`,`author`,`content`,`access_count`,`thumbnail`,`status`,`update_time`,`create_time`,`meta_description`,`deleted`) values (1,'Hello Word','admin','] mysql -u root -p\r\nEnter password: \r\nWelcome to the MySQL monitor.  Commands end with ; or \\g.\r\nYour MySQL connection id is 10\r\nServer version: 8.2.0 MySQL Community Server - GPL\r\n\r\nCopyright (c) 2000, 2023, Oracle and/or its affiliates.\r\n\r\nOracle is a registered trademark of Oracle Corporation and/or its\r\naffiliates. Other names may be trademarks of their respective\r\nowners.\r\n\r\nType \'help;\' or \'\\h\' for help. Type \'\\c\' to clear the current input statement.\r\n\r\nmysql> ALTER USER \'root\'@\'localhost\' IDENTIFIED WITH mysql_native_password BY \'root@123\';\r\nmysql> ALTER USER \'root\'@\'%\' IDENTIFIED WITH mysql_native_password BY \'root@123\';\r\nmysql> flush privileges;',0,NULL,0,'2024-01-06 23:03:13','2024-01-06 23:03:15','] mysql -u root -p\r\nEnter password: \r\nWelcome to the MySQL monitor.  Commands end with ; or \\g.\r\nYour MySQL connection id is 10\r\nServer version: 8.2.0 MySQL Community Server - GPL\r\n\r\nCopyright (c) 2000, 2023, Oracle and/or its affiliates.\r\n\r\nOracle is a registered trademark of Oracle Corporation and/or its\r\naffiliates. Other names may be trademarks of their respective\r\nowners.',0),(2,'Hello Test','admin','[Unit]\r\nDescription=MySQL Server\r\nDocumentation=man:mysqld(8)\r\nDocumentation=http://dev.mysql.com/doc/refman/en/using-systemd.html\r\nAfter=network.target\r\n\r\n[Install]\r\nWantedBy=multi-user.target\r\n\r\n[Service]\r\nUser=mysql\r\nGroup=mysql\r\nExecStart=/usr/local/mysql/bin/mysqld --defaults-file=/etc/my.cnf\r\nLimitNOFILE = 5000\r\n#Restart=on-failure\r\n#RestartPreventExitStatus=1\r\n#PrivateTmp=false',0,NULL,0,'2024-01-07 11:33:19','2024-01-07 11:33:22','[Unit]\r\nDescription=MySQL Server\r\nDocumentation=man:mysqld(8)\r\nDocumentation=http://dev.mysql.com/doc/refman/en/using-systemd.html\r\nAfter=network.target',0),(3,'Linux CentOS安装Mysql数据库','admin','# Linux CentOS安装Mysql数据库\r\n## 1 下载mysql安装包\r\n**下载安装包：https://dev.mysql.com/downloads/mysql/** \r\n\r\n```bash\r\nwget https://cdn.mysql.com//Downloads/MySQL-5.7/mysql-5.7.28-el7-x86_64.tar\r\nwget https://cdn.mysql.com/archives/mysql-5.7/mysql-5.7.39-el7-x86_64.tar\r\nwget https://dev.mysql.com/get/Downloads/MySQL-8.0/mysql-8.0.31-el7-x86_64.tar\r\n```\r\n\r\n![mysql 下载](https://www.hesc.info/upload/2019/11/mysql%20%E4%B8%8B%E8%BD%BD-384c8e242c2042dab543083ec5ff8df5.png)\r\n\r\n\r\n![mysql tar安装包](https://www.hesc.info/upload/2019/11/mysql%20tar%E5%90%8D%E7%A7%B0-bdb471f74cf946a690c7a3763f882f3c.png)\r\n\r\n> 下载好后，解压，我这里把mysql-5.7.23-el7-x86_64.tar 改名成了mysql-5.7.23.tar.gz\r\n\r\n```\r\n[root@git opt]# mv mysql-5.7.23-el7-x86_64.tar mysql-5.7.23.tar.gz\r\n[root@git opt]# \r\n[root@git opt]# tar -xcvf mysql-5.7.23.tar.gz\r\n[root@git opt]# ll\r\ntotal 697288\r\ndrwxr-xr-x. 9 root root        168 Oct 10 21:56 mysql-5.7.23\r\n-rw-r--r--. 1 7161 31415 714022690 Jun 10 23:40 mysql-5.7.23.tar.gz\r\n```\r\n![mysql tar 解压](https://www.hesc.info/upload/2019/11/%E6%94%B9%E5%90%8D-722b8f37df404805aba0df93007320b0.png)\r\n\r\n\r\n解压后有两个解压包，只管mysql-5.7.23-el7-x86_64.tar.gz这个包，另一个是测试包不用管\r\n\r\n## 2 开始安装mysql\r\n\r\n> 解压mysql5.7.23.tar.gz安装包\r\n\r\n```bash\r\ntar -zxvf mysql5.7.23.tar.gz\r\n```\r\n\r\n>创建mysql用户和mysql数据保存目录\r\n\r\n```bash\r\n//创建mysql用户\r\nuseradd -s /bin/false -d /usr/local/mysql/ mysql\r\n//创建mysql数据保存目录\r\nmkdir -p /usr/local/mysql\r\nmkdir -p /data/mysql/data\r\nmkdir -p /data/mysql/logs\r\n//分配目录权限\r\nchown -R mysql:mysql /usr/local/mysql\r\nchown -R mysql:mysql /data/mysql\r\n```\r\n\r\n> 安装依赖\r\n\r\n```bash\r\nyum -y install libaio gcc make\r\n```\r\n\r\n>开始安装Mysql数据\r\n\r\n\r\n```bash\r\n[root@git bin]# pwd\r\n/opt/mysql-5.7.23/mysql-5.7.23-el7-x86_64/bin\r\n[root@git bin]# ./mysqld --user=mysql --basedir=/usr/local/mysql --datadir=/data/mysql/data --initialize\r\n2018-08-03T08:22:14.766220Z 0 [Warning] TIMESTAMP with implicit DEFAULT value is deprecated. Please use --explicit_defaults_for_timestamp server option (see documentation for more details).\r\n2018-08-03T08:22:14.768375Z 0 [ERROR] Can\'t find error-message file \'/usr/local/mysql/share/errmsg.sys\'. Check error-message file location and \'lc-messages-dir\' configuration directive.\r\n2018-08-03T08:22:15.280059Z 0 [Warning] InnoDB: New log files created, LSN=45790\r\n2018-08-03T08:22:15.372315Z 0 [Warning] InnoDB: Creating foreign key constraint system tables.\r\n2018-08-03T08:22:15.435202Z 0 [Warning] No existing UUID has been found, so we assume that thisis the first time that this server has been started. Generating a new UUID: 543f3d19-96f6-11e8-a609-525400603f3a.\r\n2018-08-03T08:22:15.486161Z 0 [Warning] Gtid table is not ready to be used. Table \'mysql.gtid_executed\' cannot be opened.\r\n2018-08-03T08:22:15.486770Z 1 [Note] A temporary password is generated for root@localhost: wM<vlfOyU8kN\r\n//到这里就安装成功了--这个是密码:\"wM<vlfOyU8kN\"\r\n```\r\n## 3 修改my.cnf配置文件\r\n\r\n```bash\r\n[root@other-server bin]# vim /etc/my.cnf\r\n[root@other-server bin]# cat /etc/my.cnf\r\n[mysqld]\r\nsecure_file_priv=/usr/local/mysql\r\nport=3306                     	# 端口\r\nbasedir=/usr/local/mysql      	# 数据库安装路径\r\ndatadir=/data/mysql/data 		# 数据文件保存路径\r\nsocket=/data/mysql/logs/mysql.sock          # socket文件保存位置\r\ncharacter_set_server=utf8       # 数据库编码格式\r\nuser=mysql 						# 启动用户\r\nmax_connections=1500 			# 最大连接数\r\nskip-grant-tables 				# 免密码登录\r\n\r\n# Disabling symbolic-links is recommended to prevent assorted security risks\r\nsymbolic-links=0 				# 是否支持符号链接，即数据库或表可以存储在my.cnf中指定datadir之外的分区或目录，为0不开启\r\n\r\n[mysqld_safe]\r\npid-file=/data/mysql/logs/mysql.pid  # PID文件\r\nlog-error=/data/mysql/logs/error.log # 错误日志文件\r\n\r\n# include all files from the config directory\r\n!includedir /etc/my.cnf.d\r\n```\r\n## 4 启动服务\r\n\r\n> 进入到mysql安装包目录将`/bin`目录复制到`/usr/local/mysql/`下\r\n\r\n```bash\r\ncd /opt/mysql-5.7.23/mysql-5.7.23-el7-x86_64\r\ncp -r bin/ /usr/local/mysql/\r\n```\r\n![image-20221023163316333](https://hescinfo-images.oss-cn-shenzhen.aliyuncs.com/image-20221023163316333.png)\r\n\r\n> 测试启动mysql服务\r\n\r\n```bash\r\n/usr/local/mysql/bin/mysqld --defaults-file=/etc/my.cnf\r\n```\r\n\r\n## 5 设置Mysql开机启动\r\n\r\n### 5.1 创建mysql脚本\r\n\r\n> 将Mysql安装包目录下的`support-files/mysql.service`复制到`/etc/init.d/`目录下，并重命名为`mysqld`\r\n\r\n```bash\r\ncp support-files/mysql.server /etc/init.d/mysqld\r\n```\r\n\r\n### 5.2 创建`/etc/systemd/system/mysql.service`使用`systemctl`命令进行管理\r\n\r\n```bash\r\n[Unit]\r\nDescription=MySQL Server\r\nDocumentation=man:mysqld(8)\r\nDocumentation=http://dev.mysql.com/doc/refman/en/using-systemd.html\r\nAfter=network.target\r\n\r\n[Install]\r\nWantedBy=multi-user.target\r\n\r\n[Service]\r\nUser=mysql\r\nGroup=mysql\r\nExecStart=/usr/local/mysql/bin/mysqld --defaults-file=/etc/my.cnf\r\nLimitNOFILE = 5000\r\n#Restart=on-failure\r\n#RestartPreventExitStatus=1\r\n#PrivateTmp=false\r\n```\r\n\r\n> 解决问题`-bash: mysql: command not found`\r\n\r\n```bash\r\nln -s /usr/local/mysql/bin/mysql /usr/bin/mysql \r\n```\r\n\r\n> 解决问题`ERROR 2002 (HY000): Can\'t connect to local MySQL server through socket \'/tmp/mysql.sock\' (2)`\r\n\r\n```bash\r\nln -s /data/mysql/logs/mysql.sock /tmp/mysql.sock\r\n```\r\n\r\n## 6 修改root用户默认密码\r\n\r\n新安装好的MySQL没有修改root默认密码不能执行命令，会一直报错！\r\n\r\n```bash\r\nmysql> use mysql;\r\nERROR 1820 (HY000): Unknown error 1820\r\n解决方法：\r\nmysql> SET PASSWORD = PASSWORD(\'新密码\');    # 修改root密码\r\n```\r\n\r\n## 7 F&Q\r\n\r\n### 7.1 忘记密码并修改密码\r\n\r\n- 使用免密码登录，修改密码\r\n```bash\r\n1、修改my.conf配置文件\r\n编辑/etc/my.cnf配置文件在[mysqld]的段中加上一句“skip-grant-tables”参数\r\n\r\n例如： \r\n[mysqld] \r\ndatadir=/var/lib/mysql\r\nsocket=/var/lib/mysql/mysql.sock \r\nskip-grant-tables \r\n\r\n2.重新启动mysql服务\r\n[root@git bin]# service mysqld restart \r\nStopping MySQL: [ OK ]\r\nStarting MySQL: [ OK ]\r\n\r\n3．登录MySQL并修改MySQL的root密码\r\n[root@nginx-test ~]# mysql -uroot -p\r\nEnter password: # 不需要输入密码直接接入MySQL\r\nWelcome to the MySQL monitor.  Commands end with ; or \\g.\r\nYour MySQL connection id is 14159\r\nServer version: 5.7.27 MySQL Community Server (GPL)\r\n\r\nCopyright (c) 2000, 2019, Oracle and/or its affiliates. All rights reserved.\r\n\r\nOracle is a registered trademark of Oracle Corporation and/or its\r\naffiliates. Other names may be trademarks of their respective\r\nowners.\r\n\r\nType \'help;\' or \'\\h\' for help. Type \'\\c\' to clear the current input statement.\r\n\r\nmysql> use mysql; \r\nDatabase changed \r\nmysql> UPDATE user SET Password = password (\'new-password\') WHERE User = \'root\'; \r\nQuery OK, 0 rows affected (0.00 sec) Rows matched: 2 Changed: 0 Warnings: 0 \r\nmysql> flush privileges;\r\nQuery OK, 0 rows affected (0.01 sec) \r\nmysql>quit ;\r\n```\r\n- 第二种修改密码方法\r\n\r\n```bash\r\nmysql> use mysql;\r\nmysql> set password for root@localhost = password(\'123456\');\r\n如果报错需要先执行\r\nmysql> flush privileges;\r\n```\r\n### 7.2 mysql用户远程链接\r\n\r\n```bash\r\nmysql>use mysql;\r\nmysql>update user set host = \'%\' where user= \'root\';\r\nmysql>select host, user from user;\r\n\r\n```\r\n\r\n### 7.3 mysql 全目录可执行\r\n\r\n```bash\r\nln -s /usr/local/mysql/bin/mysql /usr/bin/mysql\r\n```\r\n\r\n### 7.4 阿里云远程访问\r\n\r\n```bash\r\n如果换用户无法访问，检查有无访问链接路径的权限\r\n阿里云需要配置安全组规则，开放3306端口\r\n详见https://blog.csdn.net/wei389083222/article/details/78286629\r\n```\r\n\r\n### 7.5 Mysql Error Code 2058\r\n\r\n```shell\r\n] mysql -u root -p\r\nEnter password: \r\nWelcome to the MySQL monitor.  Commands end with ; or \\g.\r\nYour MySQL connection id is 10\r\nServer version: 8.2.0 MySQL Community Server - GPL\r\n\r\nCopyright (c) 2000, 2023, Oracle and/or its affiliates.\r\n\r\nOracle is a registered trademark of Oracle Corporation and/or its\r\naffiliates. Other names may be trademarks of their respective\r\nowners.\r\n\r\nType \'help;\' or \'\\h\' for help. Type \'\\c\' to clear the current input statement.\r\n\r\nmysql> ALTER USER \'root\'@\'localhost\' IDENTIFIED WITH mysql_native_password BY \'root@123\';\r\nmysql> ALTER USER \'root\'@\'%\' IDENTIFIED WITH mysql_native_password BY \'root@123\';\r\nmysql> flush privileges;\r\n```\r\n\r\n',0,NULL,0,'2024-01-07 14:48:16','2024-01-07 14:48:19','**下载安装包：https://dev.mysql.com/downloads/mysql/** \r\n\r\n```bash\r\nwget https://cdn.mysql.com//Downloads/MySQL-5.7/mysql-5.7.28-el7-x86_64.tar\r\nwget https://cdn.mysql.com/archives/mysql-5.7/mysql-5.7.39-el7-x86_64.tar\r\nwget https://dev.mysql.com/get/Downloads/MySQL-8.0/mysql-8.0.31-el7-x86_64.tar\r\n```\r\n\r\n',0);

UNLOCK TABLES;

/*Table structure for table `tags` */

DROP TABLE IF EXISTS `tags`;

CREATE TABLE `tags` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '主键',
  `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `deleted` tinyint DEFAULT '0' COMMENT '删除状态，0=未删除;1=删除',
  `update_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '最后修改时间',
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL COMMENT '标签名称',
  `slug_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT '标签简称名称',
  `slug` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL COMMENT '标签简称ID',
  `thumbnail` varchar(1023) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT '缩略图',
  `color` varchar(25) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT '#41baff' COMMENT '标签颜色',
  PRIMARY KEY (`id`),
  KEY `tags_name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=55 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*Data for the table `tags` */

LOCK TABLES `tags` WRITE;

insert  into `tags`(`id`,`create_time`,`deleted`,`update_time`,`name`,`slug_name`,`slug`,`thumbnail`,`color`) values (1,'2019-10-15 11:36:49',0,'2023-02-04 10:30:34','Oracle','oracle','oracle','','#c12323'),(2,'2019-11-07 00:55:54',0,'2023-02-04 10:30:09','Nginx','nginx','nginx','','#06bb5a'),(3,'2019-11-07 00:55:54',0,'2023-02-04 10:30:22','Linux','linux','linux','','#2d7ac7');

UNLOCK TABLES;

/*Table structure for table `users` */

DROP TABLE IF EXISTS `users`;

CREATE TABLE `users` (
  `id` tinyint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `username` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '账ID',
  `password` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '密码',
  `email` varchar(127) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '账号邮箱',
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '账号名称',
  `description` varchar(1023) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '描述',
  `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '注册时间',
  `deleted` tinyint DEFAULT '0' COMMENT '删除状态，0=未删除;1=删除',
  `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '最后修改时间',
  PRIMARY KEY (`id`,`name`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf32;

/*Data for the table `users` */

LOCK TABLES `users` WRITE;

insert  into `users`(`id`,`username`,`password`,`email`,`name`,`description`,`create_time`,`deleted`,`update_time`) values (1,'admin','e6e061838856bf47e1de730719fb2609','admin@example.com','管理员','系统默认超级管理员账号','2024-01-06 17:46:08',0,NULL);

UNLOCK TABLES;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;
